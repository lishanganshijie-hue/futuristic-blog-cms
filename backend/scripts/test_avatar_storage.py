"""
头像与云端存储测试脚本
用于验证本地 Fallback 路径及 Cloudflare R2 存储连通性
"""
import os
import sys
from pathlib import Path

# 将项目根目录加入路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.avatar_service import AvatarFileService
from app.core.config import settings

def test_avatar_storage():
    """测试头像与云存储配置"""
    print("=" * 60)
    print(" 存储体系持久化与云端连通性测试")
    print("=" * 60)
    
    # ----------------------------------------------------
    # 1. 本地后备路径检测
    # ----------------------------------------------------
    print("\n[1/2] 检查本地存储路径 (Fallback 目录)")
    avatar_path = AvatarFileService.get_avatar_base_path()
    print(f"  - 期望本地路径: {avatar_path}")
    
    AvatarFileService.ensure_avatar_directory()
    print(f"  - 本地目录状态: {'✓ 已创建/已存在' if avatar_path.exists() else '✗ 无法创建'}")
    
    stats = AvatarFileService.get_storage_stats()
    print(f"  - 本地文件数量: {stats['total_files']} 个")
    print(f"  - 本地占用体积: {stats['total_size_mb']} MB")

    # ----------------------------------------------------
    # 2. Cloudflare R2 云端连通性测试
    # ----------------------------------------------------
    print("\n[2/2] 检查 Cloudflare R2 云端存储状态")
    
    # 检查核心环境变量是否配齐
    r2_configs = {
        "S3_ENDPOINT_URL": settings.S3_ENDPOINT_URL,
        "S3_BUCKET_NAME": settings.S3_BUCKET_NAME,
        "S3_PUBLIC_URL": settings.S3_PUBLIC_URL
    }
    
    missing_configs = [k for k, v in r2_configs.items() if not v]
    
    if missing_configs:
        print(f"  ⚠ 发现未配置的 R2 变量: {', '.join(missing_configs)}")
        print("  🚨 系统当前正降级运行在【本地纯硬盘模式】！部署重置时文件会丢失。")
        
        env_path = os.getenv("AVATAR_STORAGE_PATH") or os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
        if env_path:
            print(f"  ✓ 检测到本地挂载卷环境变量: {env_path}，本地数据暂安全。")
        else:
            print("  ❌ 警告：未检测到任何云存储或本地挂载卷，数据随时有丢失风险！")
    else:
        print("  ✓ R2 基础环境变量已配齐")
        print(f"  - 终结点 (Endpoint): {settings.S3_ENDPOINT_URL}")
        print(f"  - 存储桶 (Bucket): {settings.S3_BUCKET_NAME}")
        print(f"  - 公开域名 (Public URL): {settings.S3_PUBLIC_URL}")
        
        # 尝试通过 boto3 客户端进行真实的云端读写擦除测试
        try:
            from app.services.r2_storage import r2_client
            test_key = "avatars/r2_persistence_test.txt"
            
            print("\n  正在向 R2 存储桶投放测试文件...")
            # 1. 尝试上传
            r2_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=test_key,
                Body=b"Cloudflare R2 persistence and connection test verification.",
                ContentType="text/plain"
            )
            print(f"  ✓ 投放成功！云端 Key: {test_key}")
            
            # 2. 尝试物理擦除 (测试刚才写入的删除能力，保持存储桶干净)
            print("  正在验证云端同步物理擦除能力...")
            r2_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=test_key)
            print("  ✓ 擦除成功！云端测试痕迹已清理。")
            
            print("\n" + "=" * 60)
            print("🎉 恭喜！Cloudflare R2 云端分布式存储配置完全正确，完美持久化！")
            print("=" * 60)
            return
            
        except Exception as e:
            print(f"  ❌ R2 联调测试失败！错误信息: {e}")
            print("  请检查 S3_ACCESS_KEY_ID 和 S3_SECRET_ACCESS_KEY 是否有误。")

    print("\n" + "=" * 60)
    print("本地检查完成（未通过 R2 云端全栈测试）")
    print("=" * 60)


if __name__ == "__main__":
    test_avatar_storage()