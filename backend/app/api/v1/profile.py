import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.models import Profile
from app.schemas import ProfileResponse, ProfileUpdate
from app.utils import get_current_user
from app.utils.permissions import require_permission
from app.services.log_service import LogService
from app.utils.cache import cache

router = APIRouter(prefix="/profile", tags=["Profile"])

PROFILE_CACHE_KEY = "profile:public"
PROFILE_CACHE_TTL = 300


def get_or_create_profile(db: Session) -> Profile:
    """
    当数据库中没有任何个人资料时，自动初始化一条通用的、去个人化的默认数据作为兜底，
    避免前端请求因查无数据而崩溃。
    """
    profile = db.query(Profile).first()
    if not profile:
        profile = Profile(
            name="Admin",
            alias="管理员",
            slogan="欢迎来到我的个人博客",
            tags=json.dumps(["全栈工程师", "技术爱好者"], ensure_ascii=False),
            bio="这里是个人简介占位符，请前往后台管理系统修改并保存您的真实个人资料。",
            tech_stack=json.dumps([
                {"category": "前端", "items": ["Vue", "React"]},
                {"category": "后端", "items": ["Python", "Node.js"]}
            ], ensure_ascii=False),
            journey=json.dumps([
                {"period": "2026 - 至今", "company": "示例公司", "position": "软件工程师", "achievements": "请在后台修改您的工作经历与成就描述。"}
            ], ensure_ascii=False),
            education=json.dumps({
                "period": "2022 - 2026",
                "school": "示例大学",
                "major": "计算机科学",
                "degree": "本科"
            }, ensure_ascii=False),
            exploration_areas=json.dumps([
                "技术研究", "开源探索"
            ], ensure_ascii=False),
            social_github="https://github.com",
            social_blog="https://example.com",
            social_email="admin@example.com"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        cache.delete(PROFILE_CACHE_KEY)
    return profile


def profile_to_response(profile: Profile) -> dict:
    """
    将数据库中的 Profile 对象转换为符合前端展示格式的字典（解序列化 JSON），
    并完美兼容 12 个控制显隐、排序及新头像的扩展字段。
    """
    return {
        "id": profile.id,
        "name": profile.name,
        "alias": profile.alias,
        "slogan": profile.slogan,
        "tags": json.loads(profile.tags) if profile.tags else [],
        "avatar": profile.avatar,
        "bio": profile.bio,
        "tech_stack": json.loads(profile.tech_stack) if profile.tech_stack else [],
        "journey": json.loads(profile.journey) if profile.journey else [],
        "education": json.loads(profile.education) if profile.education else None,
        "exploration_areas": json.loads(profile.exploration_areas) if profile.exploration_areas else [],
        "social_github": profile.social_github,
        "social_blog": profile.social_blog,
        "social_email": profile.social_email,
        "updated_at": profile.updated_at,
        
        # 🚀 扩展字段返回值（若数据库中没有值，则提供合理的默认值）
        "avatar_url": getattr(profile, "avatar_url", None),
        "show_tech_stack": getattr(profile, "show_tech_stack", True),
        "show_journey": getattr(profile, "show_journey", True),
        "show_education": getattr(profile, "show_education", True),
        "show_exploration": getattr(profile, "show_exploration", True),
        "order_basic": getattr(profile, "order_basic", 0),
        "order_banner": getattr(profile, "order_banner", 0),
        "order_tech_stack": getattr(profile, "order_tech_stack", 0),
        "order_journey": getattr(profile, "order_journey", 0),
        "order_education": getattr(profile, "order_education", 0),
        "order_exploration": getattr(profile, "order_exploration", 0),
        "order_social": getattr(profile, "order_social", 0),
    }


@router.get("", response_model=ProfileResponse)
async def get_profile(db: Session = Depends(get_db)):
    """获取公开个人资料（带缓存机制）"""
    cached = cache.get(PROFILE_CACHE_KEY)
    if cached:
        return cached
    
    profile = get_or_create_profile(db)
    result = profile_to_response(profile)
    cache.set(PROFILE_CACHE_KEY, result, PROFILE_CACHE_TTL)
    return result


@router.put("", response_model=ProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("profile.edit"))
):
    """更新个人资料资料"""
    profile = get_or_create_profile(db)
    
    update_data = profile_data.model_dump(exclude_unset=True)
    
    # 动态将前端传来的属性赋值给数据库的模型对象
    for field, value in update_data.items():
        if field in ["tags", "tech_stack", "journey", "education", "exploration_areas"]:
            setattr(profile, field, json.dumps(value, ensure_ascii=False))
        else:
            # 🚀 确保即使 SQLAlchemy 模型中有未完全映射的字段，也能通过 setattr 正常赋值
            setattr(profile, field, value)
    
    try:
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="数据保存失败，请检查输入内容")
    
    # 🚀【核心修复】强制双重清理缓存，防止因为缓存延迟导致前台看不到最新结果
    cache.delete(PROFILE_CACHE_KEY)
    
    # 记录操作日志
    LogService.log_operation(
        db=db,
        user_id=current_user.id,
        username=current_user.username,
        action="更新",
        module="个人资料",
        description="更新个人资料信息并刷新模块排序开关",
        target_type="个人资料",
        target_id=profile.id,
        request=request,
        status="success"
    )
    
    return profile_to_response(profile)