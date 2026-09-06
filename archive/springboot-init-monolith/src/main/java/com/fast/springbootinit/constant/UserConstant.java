package com.fast.springbootinit.constant;

/**
 * 用户常量：登录态 Session Key 与角色定义（user 普通用户 / admin 管理员 / ban 封号），
 * 接口权限校验配合 @AuthCheck(mustRole = UserConstant.ADMIN_ROLE) 使用
 */
public interface UserConstant {

    /**
     * 用户登录态键（Session 中存放登录用户信息的 key，由 AuthInterceptor 读取）
     */
    String USER_LOGIN_STATE = "user_login";

    //  region 权限

    /**
     * 默认角色
     */
    String DEFAULT_ROLE = "user";

    /**
     * 管理员角色
     */
    String ADMIN_ROLE = "admin";

    /**
     * 被封号
     */
    String BAN_ROLE = "ban";

    // endregion
}
