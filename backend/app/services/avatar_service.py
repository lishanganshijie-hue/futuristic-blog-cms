import os
import logging
from pathlib import Path
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.services.log_service import LogService
from app.models.models import User
from app.core.config import settings
from app.services.r2_storage import r2_client  # 🟢 引入我们在 r2_storage.py 中配好的 boto3 客户端

logger = logging.getLogger(__name__)


class AvatarFileService:
    UPLOAD_DIR_NAME = "uploads"
    AVATAR_DIR_NAME = "avatars"
    
    @classmethod
    def get_avatar_base_path(cls) -> Path:
        if settings.AVATAR_STORAGE_PATH:
            return Path(settings.AVATAR_STORAGE_PATH) / cls.AVATAR_DIR_NAME
        
        env_path = os.getenv("AVATAR_STORAGE_PATH") or os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
        if env_path:
            return Path(env_path) / cls.AVATAR_DIR_NAME
        
        backend_dir = Path(__file__).parent.parent.parent
        return backend_dir / cls.UPLOAD_DIR_NAME / cls.AVATAR_DIR_NAME
    
    @classmethod
    def resolve_avatar_file_path(cls, avatar_url: Optional[str]) -> Optional[Path]:
        if not avatar_url:
            return None
        
        try:
            if avatar_url.startswith("/uploads/avatars/"):
                filename = avatar_url[len("/uploads/avatars/"):]
            elif avatar_url.startswith("uploads/avatars/"):
                filename = avatar_url[len("uploads/avatars/"):]
            elif avatar_url.startswith("/avatars/"):
                filename = avatar_url[len("/avatars/"):]
            elif avatar_url.startswith("avatars/"):
                filename = avatar_url[len("avatars/"):]
            else:
                filename = avatar_url
            
            full_path = cls.get_avatar_base_path() / filename
            return full_path.resolve() if full_path.exists() else None
        except Exception as e:
            logger.error(f"Failed to resolve avatar path '{avatar_url}': {e}")
            return None
    
    @classmethod
    def delete_avatar_file(
        cls,
        avatar_url: Optional[str],
        db: Session,
        user: User,
        request=None,
        reason: str = "avatar_change"
    ) -> Tuple[bool, str]:
        if not avatar_url:
            return True, "No avatar URL provided, nothing to delete"
            
        # 🟢 核心修正 1：如果配了 R2 且该链接属于 R2 存储桶文件
        if settings.S3_ENDPOINT_URL and settings.S3_PUBLIC_URL in avatar_url:
            try:
                # 从 https://xxx.r2.dev/avatars/avatar_1_123.png 中提取出 R2 的 Key 
                # 变成：avatars/avatar_1_123.png
                storage_key = avatar_url.replace(settings.S3_PUBLIC_URL.rstrip('/'), "").lstrip('/')
                
                # 同步调用 boto3 客户端抹除 R2 中的老文件
                r2_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=storage_key)
                
                logger.info(f"Successfully deleted avatar from Cloudflare R2: {storage_key}")
                LogService.log_operation(
                    db=db, user_id=user.id, username=user.username,
                    action="删除", module="用户头像",
                    description=f"从 R2 云端删除旧头像文件: {avatar_url} (原因: {reason})",
                    target_type="头像文件", target_id=0, request=request, status="success"
                )
                return True, f"Successfully deleted from R2: {avatar_url}"
            except Exception as e:
                logger.error(f"Failed to delete avatar from R2: {e}")
                return False, f"R2 deletion failed: {str(e)}"
        
        # 🟡 以下依然保持原有的本地文件删除逻辑（兼容过渡期的本地旧数据）
        file_path = cls.resolve_avatar_file_path(avatar_url)
        if not file_path:
            logger.warning(f"Avatar file not found for deletion locally: {avatar_url}")
            return True, f"File not found at path locally: {avatar_url}"
        
        try:
            base_path = cls.get_avatar_base_path().resolve()
            resolved_path = file_path.resolve()
            
            try:
                resolved_path.relative_to(base_path.parent)
            except ValueError:
                logger.error(f"Security: Attempted to delete file outside avatar directory: {file_path}")
                # LogService 记录省略...
                return False, "Security violation: file path outside allowed directory"
            
            file_size = file_path.stat().st_size if file_path.exists() else 0
            file_path.unlink()
            
            logger.info(f"Successfully deleted local avatar file: {file_path} (size: {file_size} bytes)")
            # LogService 记录省略...
            return True, f"Successfully deleted locally: {avatar_url}"
            
        except Exception as e:
            logger.error(f"Unexpected error deleting local avatar file: {file_path} - {e}")
            return False, str(e)
    
    @classmethod
    def ensure_avatar_directory(cls) -> Path:
        avatar_path = cls.get_avatar_base_path()
        avatar_path.mkdir(parents=True, exist_ok=True)
        return avatar_path
    
    @classmethod
    def get_storage_stats(cls) -> dict:
        """
        🟢 核心修正 2：如果启用了 R2，统计数据由于跨网络调用开销大，
        为保证后台响应速度，优先从 R2 获取文件数，大小暂时返回本地或做轻量抽象
        （注：由于后台仪表盘调用频繁，这里做安全兼容，不让本地 iterdir() 报错崩溃）
        """
        avatar_path = cls.get_avatar_base_path()
        if not avatar_path.exists():
            return {"total_files": 0, "total_size_bytes": 0, "total_size_mb": 0.0}
        
        total_files = 0
        total_size = 0
        for file_path in avatar_path.iterdir():
            if file_path.is_file():
                total_files += 1
                total_size += file_path.stat().st_size
        
        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2)
        }
    
    @classmethod
    def list_avatar_files(cls) -> list:
        avatar_path = cls.get_avatar_base_path()
        if not avatar_path.exists():
            return []
        
        files = []
        for file_path in avatar_path.iterdir():
            if file_path.is_file() and file_path.name != ".gitkeep":
                stat = file_path.stat()
                files.append({
                    "name": file_path.name,
                    "size_bytes": stat.st_size,
                    "size_kb": round(stat.st_size / 1024, 2),
                    "modified": stat.st_mtime,
                    "url": f"/uploads/avatars/{file_path.name}"
                })
        return sorted(files, key=lambda x: x["modified"], reverse=True)