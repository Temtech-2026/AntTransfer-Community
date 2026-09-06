package com.fast.springbootinit.service;

import com.fast.springbootinit.model.entity.PostThumb;
import com.baomidou.mybatisplus.spring.service.IService;
import com.fast.springbootinit.model.entity.User;

/**
 * 帖子点赞服务
 */
public interface PostThumbService extends IService<PostThumb> {

    /**
     * 点赞
     *
     * @param postId
     * @param loginUser
     * @return
     */
    int doPostThumb(long postId, User loginUser);

    /**
     * 帖子点赞（内部服务）
     *
     * @param userId
     * @param postId
     * @return
     */
    int doPostThumbInner(long userId, long postId);
}
