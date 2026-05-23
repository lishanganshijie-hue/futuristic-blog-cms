"""
Supabase 兼容层 (已重定向至 Cloudflare R2)
保持原有的方法签名不变，避免上层调用崩溃，但底层彻底切换为 R2 对象存储
"""
import logging
import asyncio
from typing import Optional, BinaryIO, List
import httpx
from app.core.config import settings
from app.services.r2_storage import r2_client  # 🟢 引入真正的 R2 客户端服务

logger = logging.getLogger(__name__)

# 保留原有的缓存策略定义
CACHE_POLICIES = {
    "image": "public, max-age=31536000, immutable",
    "avatar": "public, max-age=604800, stale-while-revalidate=2592000",
    "document": "public, max-age=31536000, immutable",
    "audio": "public, max-age=31536000, immutable",
    "video": "public, max-age=31536000, immutable",
    "default": "public, max-age=31536000, immutable",
}


def get_cache_policy(storage_key: str) -> str:
    if storage_key.startswith("avatars/"):
        return CACHE_POLICIES["avatar"]
    if storage_key.startswith("images/"):
        return CACHE_POLICIES["image"]
    if storage_key.startswith("audio/"):
        return CACHE_POLICIES["audio"]
    if storage_key.startswith("videos/"):
        return CACHE_POLICIES["video"]
    if storage_key.startswith("articles/"):
        return CACHE_POLICIES["document"]
    return CACHE_POLICIES["default"]


class SupabaseStorageService:
    def __init__(self):
        # 🟢 判定标准变更为：只要开启了 R2 终终点，此服务就维持“可用”伪装
        self.is_r2_active = bool(settings.S3_ENDPOINT_URL and settings.S3_BUCKET_NAME)
        if self.is_r2_active:
            logger.info("SupabaseStorageService 兼容层已激活，底层流量已成功重定向至 Cloudflare R2")
        else:
            logger.warning("R2 存储配置未就绪，兼容层运行在本地 Fallback 模式")

    def is_enabled(self) -> bool:
        return self.is_r2_active

    def get_upload_method(self) -> str:
        return "s3" if self.is_r2_active else "none"

    async def upload_file(
        self,
        file_data: BinaryIO,
        key: str,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        """伪装上传：内部实际向 R2 投递文件"""
        if not self.is_enabled():
            logger.error("R2 存储未配置，无法通过兼容层上传文件")
            return None

        try:
            file_content = file_data.read()
            cache_policy = get_cache_policy(key)

            extra_args = {
                'CacheControl': cache_policy
            }
            if content_type:
                extra_args['ContentType'] = content_type

            # 🟢 狸猫换太子：使用 R2 Client 代替原有的 Supabase S3 Client
            logger.info(f"[R2 兼容层] 正在上传文件至 R2 桶: key={key}")
            
            # 使用 loop.run_in_executor 避免 boto3 同步阻塞异步循环
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: r2_client.put_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=key,
                    Body=file_content,
                    **extra_args
                )
            )

            # 🟢 拼接出真正的 R2 开放访问链接
            public_url = f"{settings.S3_PUBLIC_URL.rstrip('/')}/{key.lstrip('/')}"
            logger.info(f"[R2 兼容层] 上传成功。新云端 URL: {public_url}")

            # 异步触发缓存预热（如果 R2 绑定了 CDN 或用于激活动态缓存）
            asyncio.create_task(self._warmup_cache_async(public_url, key))
            
            return public_url

        except Exception as e:
            logger.error(f"[R2 兼容层] 文件投递至 R2 失败: {e}", exc_info=True)
            return None

    async def _warmup_cache_async(self, url: str, key: str):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, follow_redirects=True)
                if response.status_code == 200:
                    logger.info(f"R2 边缘节点缓存预热成功: {key}")
                else:
                    logger.warning(f"R2 边缘节点返回非常规状态码 {response.status_code}: {key}")
        except Exception as e:
            logger.warning(f"R2 边缘缓存预热未完全响应 (非致命错误): {key} - {e}")

    async def warmup_cache(self, url: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, follow_redirects=True)
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"缓存预热请求异常: {url} - {e}")
            return False

    async def warmup_cache_batch(self, urls: List[str]) -> dict:
        result = {"success": 0, "failed": 0}
        for url in urls:
            success = await self.warmup_cache(url)
            if success:
                result["success"] += 1
            else:
                result["failed"] += 1
            await asyncio.sleep(0.02)
        return result

    async def update_cache_control(self, key: str, cache_control: Optional[str] = None) -> bool:
        """重定向 R2 对象的 CacheControl"""
        if not self.is_enabled():
            return False
        try:
            if cache_control is None:
                cache_control = get_cache_policy(key)

            loop = asyncio.get_running_loop()
            head = await loop.run_in_executor(
                None, lambda: r2_client.head_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            )

            copy_args = {
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': key,
                'CopySource': {'Bucket': settings.S3_BUCKET_NAME, 'Key': key},
                'CacheControl': cache_control,
                'MetadataDirective': 'REPLACE',
                'ContentType': head.get('ContentType', 'application/octet-stream'),
            }

            await loop.run_in_executor(None, lambda: r2_client.copy_object(**copy_args))
            return True
        except Exception as e:
            logger.error(f"[R2 兼容层] 修正元数据缓存策略失败 {key}: {e}")
            return False

    async def batch_update_cache_control(self, prefix: Optional[str] = None) -> dict:
        # R2 大批量处理建议去后台处理，此处做安全空返回，防止阻塞后台
        return {"updated": 0, "failed": 0, "errors": []}

    async def delete_file(self, key: str) -> bool:
        """通过 R2 删除老文件"""
        if not self.is_enabled():
            return False
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, lambda: r2_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            )
            logger.info(f"[R2 兼容层] 物理文件已安全从 R2 中抹除: {key}")
            return True
        except Exception as e:
            logger.error(f"[R2 兼容层] 从 R2 删除文件失败 {key}: {e}")
            return False

    async def get_file_url(self, key: str) -> Optional[str]:
        if not self.is_enabled():
            return None
        return f"{settings.S3_PUBLIC_URL.rstrip('/')}/{key.lstrip('/')}"

    async def file_exists(self, key: str) -> bool:
        if not self.is_enabled():
            return False
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, lambda: r2_client.head_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            )
            return True
        except Exception:
            return False


# 保持单例导出命名一致
supabase_storage = SupabaseStorageService()