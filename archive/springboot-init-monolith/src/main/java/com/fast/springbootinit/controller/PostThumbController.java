// @modified 2026-08-26 技术栈升级：Spring Boot 3.5.14 + JDK 21（javax 迁移 jakarta）
package com.fast.springbootinit.controller;

import com.fast.springbootinit.common.BaseResponse;
import com.fast.springbootinit.common.ErrorCode;
import com.fast.springbootinit.common.ResultUtils;
import com.fast.springbootinit.exception.BusinessException;
import com.fast.springbootinit.model.dto.postthumb.PostThumbAddRequest;
import com.fast.springbootinit.model.entity.User;
import com.fast.springbootinit.service.PostThumbService;
import com.fast.springbootinit.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 帖子点赞接口
 */
@RestController
@RequestMapping("/post_thumb")
@Slf4j
public class PostThumbController {

    @Resource
    private PostThumbService postThumbService;

    @Resource
    private UserService userService;

    /**
     * 点赞 / 取消点赞
     *
     * @param postThumbAddRequest
     * @param request
     * @return resultNum 本次点赞变化数
     */
    @PostMapping("/")
    public BaseResponse<Integer> doThumb(@RequestBody PostThumbAddRequest postThumbAddRequest,
            HttpServletRequest request) {
        if (postThumbAddRequest == null || postThumbAddRequest.getPostId() <= 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        // 登录才能点赞
        final User loginUser = userService.getLoginUser(request);
        long postId = postThumbAddRequest.getPostId();
        int result = postThumbService.doPostThumb(postId, loginUser);
        return ResultUtils.success(result);
    }

}
