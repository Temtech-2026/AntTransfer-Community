/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.anttransfer.file.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.dto.AssignTagsRequest;
import com.anttransfer.file.model.dto.NodeTagRow;
import com.anttransfer.file.model.dto.TagRequest;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileTag;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.entity.Tag;
import com.anttransfer.file.model.vo.TagVO;
import com.anttransfer.file.repository.FileTagMapper;
import com.anttransfer.file.repository.TagMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 标签服务：标签 CRUD + 文件打标 / 取消 + 列表页标签回显。
 *
 * <p><b>越权口径：</b>别人的标签一律按「不存在」处理（返回 2005 而不是 403）——
 * 若对外区分「无权限」与「不存在」，就等于把标签 ID 空间开放成可枚举资源，
 * 攻击者能从错误码差异里推断出别人建了哪些标签。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TagService {

    private final TagMapper tagMapper;
    private final FileTagMapper fileTagMapper;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;
    private final FileProperties properties;

    /**
     * 列出当前用户的全部标签（附关联文件数）。
     *
     * @param ownerUserId 归属用户 ID
     * @return 标签列表（按创建顺序）
     */
    @Transactional(readOnly = true)
    public List<TagVO> list(Long ownerUserId) {
        List<Tag> tags = tagMapper.selectList(Wrappers.<Tag>lambdaQuery()
                .eq(Tag::getOwnerUserId, ownerUserId)
                .orderByAsc(Tag::getId));
        List<TagVO> result = new ArrayList<>(tags.size());
        for (Tag tag : tags) {
            result.add(withRefCount(tag, fileTagMapper.countByTag(tag.getId())));
        }
        return result;
    }

    /**
     * 查询某文件当前挂的标签（详情页 / 打标回显）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @return 标签列表
     */
    @Transactional(readOnly = true)
    public List<TagVO> nodeTags(Long ownerUserId, Long nodeId) {
        ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        return loadNodeTags(nodeId);
    }

    /**
     * 创建标签。
     *
     * @param ownerUserId 归属用户 ID
     * @param request     创建请求
     * @return 新建标签
     */
    @Transactional(rollbackFor = Exception.class)
    public TagVO create(Long ownerUserId, TagRequest request) {
        String name = normalizeName(request.getName());
        if (tagMapper.findByOwnerAndName(ownerUserId, name) != null) {
            throw new BusinessException(ErrorCode.TAG_NAME_CONFLICT);
        }
        Tag tag = new Tag();
        tag.setOwnerUserId(ownerUserId);
        tag.setName(name);
        tag.setColor(normalizeColor(request.getColor()));
        tag.setCreateBy(ownerUserId);
        tag.setUpdateBy(ownerUserId);
        try {
            tagMapper.insert(tag);
        } catch (DuplicateKeyException e) {
            // 两个请求同时建同名标签：唯一键兜底，对用户而言与「已存在」是同一件事
            throw new BusinessException(ErrorCode.TAG_NAME_CONFLICT);
        }
        auditLogger.success(OperationLog.ACTION_FILE_TAG, OperationLog.TARGET_TAG, tag.getId(),
                Map.of("op", "create", "name", name));
        return TagVO.of(tag);
    }

    /**
     * 更新标签（改名 / 改色）。
     *
     * @param ownerUserId 归属用户 ID
     * @param tagId       标签 ID
     * @param request     更新请求
     * @return 更新后的标签
     */
    @Transactional(rollbackFor = Exception.class)
    public TagVO update(Long ownerUserId, Long tagId, TagRequest request) {
        Tag tag = requireOwnedTag(ownerUserId, tagId);
        String name = normalizeName(request.getName());
        Tag sameName = tagMapper.findByOwnerAndName(ownerUserId, name);
        if (sameName != null && !Objects.equals(sameName.getId(), tagId)) {
            throw new BusinessException(ErrorCode.TAG_NAME_CONFLICT);
        }
        String color = normalizeColor(request.getColor());
        tagMapper.update(null, Wrappers.<Tag>lambdaUpdate()
                .eq(Tag::getId, tagId)
                .eq(Tag::getOwnerUserId, ownerUserId)
                .set(Tag::getName, name)
                .set(Tag::getColor, color)
                .set(Tag::getUpdateBy, ownerUserId));

        auditLogger.success(OperationLog.ACTION_FILE_TAG, OperationLog.TARGET_TAG, tagId,
                Map.of("op", "update", "name", name));
        tag.setName(name);
        tag.setColor(color);
        return withRefCount(tag, fileTagMapper.countByTag(tagId));
    }

    /**
     * 删除标签：先断关联、再删标签。
     *
     * <p>顺序不能反。若先删标签再断关联，中间这段时间按该标签筛选仍能查出文件，
     * 而且是「筛一个不存在的标签却有结果」这种最难解释的状态。先断关联则最坏情况是
     * 「标签还在、但暂时筛不出关联文件」，随后标签行消失，语义始终自洽。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param tagId       标签 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long ownerUserId, Long tagId) {
        Tag tag = requireOwnedTag(ownerUserId, tagId);
        long affected = fileTagMapper.countByTag(tagId);
        fileTagMapper.deleteByTagId(tagId);
        tagMapper.deleteById(tagId);
        auditLogger.success(OperationLog.ACTION_FILE_TAG, OperationLog.TARGET_TAG, tagId,
                Map.of("op", "delete", "name", tag.getName(), "detachedNodes", affected));
    }

    /**
     * 给文件全量覆盖标签集合（传空数组即清空）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @param request     打标请求
     * @return 覆盖后的标签列表
     */
    @Transactional(rollbackFor = Exception.class)
    public List<TagVO> assign(Long ownerUserId, Long nodeId, AssignTagsRequest request) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        if (node.inRecycle()) {
            // 回收站文件的标签集合会在还原后立刻变得无意义，不如要求先还原，语义更清晰
            throw new BusinessException(ErrorCode.FILE_IN_RECYCLE);
        }
        List<Long> tagIds = request.getTagIds() == null ? List.of() : request.getTagIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (tagIds.size() > properties.getTagMaxPerFile()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "单文件标签数不能超过 " + properties.getTagMaxPerFile());
        }
        if (!tagIds.isEmpty()) {
            long owned = tagMapper.selectBatchIds(tagIds).stream()
                    .filter(tag -> Objects.equals(tag.getOwnerUserId(), ownerUserId))
                    .count();
            if (owned != tagIds.size()) {
                // 混入他人标签 / 不存在的标签：统一口径，不泄露「这个 ID 是别人的」
                throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "包含不存在或无权使用的标签");
            }
        }
        fileTagMapper.deleteByNodeId(nodeId);
        for (Long tagId : tagIds) {
            FileTag relation = new FileTag();
            relation.setNodeId(nodeId);
            relation.setTagId(tagId);
            relation.setOwnerUserId(ownerUserId);
            relation.setCreateBy(ownerUserId);
            relation.setUpdateBy(ownerUserId);
            fileTagMapper.insert(relation);
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("op", "assign");
        extra.put("tagIds", tagIds);
        auditLogger.success(OperationLog.ACTION_FILE_TAG, OperationLog.TARGET_FILE, nodeId, extra);
        return loadNodeTags(nodeId);
    }

    /*
     * 说明：这里刻意<b>不</b>提供「按一组 nodeId 批量取标签」的公开方法。
     * 那种签名（只吃 nodeIds、不吃 ownerUserId）无论怎么实现都在诱导调用方先查后校验，
     * 一旦某个列表接口忘了先做归属过滤，它就成了按 ID 批量拖走他人标签的越权通道，
     * 且出错时是静默的。列表页回显改由 FileNodeService#loadTags 在
     * 「已按 owner_user_id 过滤完的分页结果」之上做，输入天然可信。
     */

    /* ============================ 内部实现 ============================ */

    private List<TagVO> loadNodeTags(Long nodeId) {
        List<NodeTagRow> rows = fileTagMapper.findTagsByNodeIds(List.of(nodeId));
        List<TagVO> tags = new ArrayList<>(rows.size());
        for (NodeTagRow row : rows) {
            TagVO vo = new TagVO();
            vo.setId(row.getTagId());
            vo.setName(row.getName());
            vo.setColor(row.getColor());
            tags.add(vo);
        }
        return tags;
    }

    private static TagVO withRefCount(Tag tag, long refCount) {
        TagVO vo = TagVO.of(tag);
        vo.setRefCount(refCount);
        return vo;
    }

    private Tag requireOwnedTag(Long ownerUserId, Long tagId) {
        if (tagId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "标签 ID 不能为空");
        }
        Tag tag = tagMapper.selectById(tagId);
        if (tag == null || !Objects.equals(tag.getOwnerUserId(), ownerUserId)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "标签不存在");
        }
        return tag;
    }

    private String normalizeName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "标签名不能为空");
        }
        if (name.length() > properties.getTagMaxLength()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "标签名长度不能超过 " + properties.getTagMaxLength());
        }
        return name;
    }

    private static String normalizeColor(String color) {
        if (!StringUtils.hasText(color)) {
            return null;
        }
        return color.trim();
    }
}
