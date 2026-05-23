import boto3
from botocore.config import Config
from fastapi.concurrency import run_in_threadpool  # 🟢 引入 FastAPI 官方线程池工具
from app.core.config import settings

# 初始化 Cloudflare R2 客户端 (利用 S3 协议)
r2_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto' # Cloudflare R2 固定填 auto
)

def _sync_put_object(bucket_name, file_name, file_data, content_type):
    """一个纯粹的同步上传任务"""
    return r2_client.put_object(
        Bucket=bucket_name,
        Key=file_name,
        Body=file_data,
        ContentType=content_type
    )

async def upload_file_to_r2(file_data: bytes, file_name: str, content_type: str) -> str:
    """上传文件到 Cloudflare R2 并返回公开访问的 URL"""
    bucket_name = settings.S3_BUCKET_NAME
    
    # 🟢 核心修正：利用线程池安全、完整地执行同步的 boto3 请求
    # 这能防止请求在异步事件循环中被强行掐断
    await run_in_threadpool(
        _sync_put_object, 
        bucket_name, 
        file_name, 
        file_data, 
        content_type
    )
    
    # 🔗 拼装出 Cloudflare R2 的公开 CDN 加速链接返回给前端 Vue3/Astro
    return f"{settings.S3_PUBLIC_URL.rstrip('/')}/{file_name}"