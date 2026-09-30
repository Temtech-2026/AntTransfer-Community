/** System management (users / roles / departments / groups / menu permissions) copy. */
export default {
  // Actions and column names reused across system pages
  'system.action.edit': 'Edit',
  'system.action.delete': 'Delete',
  'system.action.create': 'Create',
  'system.column.action': 'Actions',
  'system.column.status': 'Status',
  'system.column.remark': 'Remark',
  'system.column.createTime': 'Created at',
  'system.alert.boundaryTitle': 'Operation boundaries',

  // User status
  'system.userStatus.normal': 'Active',
  'system.userStatus.disabled': 'Disabled',
  'system.userStatus.locked': 'Locked',
  'system.userStatus.unknown': 'Unknown',

  // Data scope
  'system.dataScope.self': 'Self only',
  'system.dataScope.deptAndSub': 'Own department and below',
  'system.dataScope.all': 'All',
  'system.dataScope.unknown': 'Unknown ({scope})',

  // Permission point type
  'system.permType.menu': 'Menu',
  'system.permType.action': 'Action',
  'system.permType.dataScope': 'Data scope',
  'system.permType.unknown': 'Unknown ({type})',

  // User management page
  'system.user.title': 'User management',
  'system.user.subtitle': 'Accounts, departments, status and role assignment',
  'system.user.alertBoundary':
    'Protected accounts cannot be disabled, deleted or re-assigned. Administrators cannot disable, reset the password of, assign roles to, or delete themselves (the server rejects these, including self-privilege-escalation). When your data scope is limited, both the list and the role dropdown narrow automatically.',
  'system.user.column.keyword': 'Account / nickname',
  'system.user.column.keywordPlaceholder': 'Account or nickname, fuzzy match',
  'system.user.column.username': 'Account',
  'system.user.column.nickname': 'Nickname',
  'system.user.column.dept': 'Department',
  'system.user.column.deptPlaceholder': 'All visible departments',
  'system.user.column.roles': 'Roles',
  'system.user.column.lastLogin': 'Last login',
  'system.user.protectedTag': 'Protected',
  'system.user.action.assignRole': 'Assign roles',
  'system.user.action.resetPassword': 'Reset password',
  'system.user.action.disable': 'Disable',
  'system.user.action.enable': 'Enable',
  'system.user.action.locked': 'Locked',
  'system.user.action.create': 'New user',
  'system.user.confirm.disableTitle': 'Disable this account?',
  'system.user.confirm.enableTitle': 'Enable this account?',
  'system.user.confirm.disableDesc':
    'All active sessions of this account will be revoked immediately.',
  'system.user.confirm.deleteTitle': 'Delete this user?',
  'system.user.confirm.deleteDesc':
    'This cannot be undone; protected accounts or accounts still referenced will be rejected by the server.',
  'system.user.message.disabled': 'Disabled {name}',
  'system.user.message.enabled': 'Enabled {name}',
  'system.user.message.deleted': 'Deleted {name}',

  // Avatar (dedicated channel: takes effect on upload, not part of the form save)
  'system.user.avatar.label': 'Avatar',
  'system.user.avatar.upload': 'Upload avatar',
  'system.user.avatar.hint': 'PNG / JPEG / GIF / WebP, up to {max}',
  'system.user.avatar.updated': 'Avatar updated',
  'system.user.avatar.tooLarge': 'Image must not exceed {max}',
  'system.user.avatar.typeInvalid':
    'Only PNG / JPEG / GIF / WebP images are supported',

  // User create / edit modal
  'system.userForm.title.edit': 'Edit user · {name}',
  'system.userForm.title.create': 'New user',
  'system.userForm.alert.title':
    'Account name, status, roles and password are not part of this form',
  'system.userForm.alert.desc':
    'The account name cannot be changed; use the corresponding buttons in the list for status, password and roles. Remark editing is not offered because the API does not return it.',
  'system.userForm.field.username': 'Login account',
  'system.userForm.field.password': 'Initial password',
  'system.userForm.field.nickname': 'Nickname / name',
  'system.userForm.field.dept': 'Department',
  'system.userForm.field.email': 'Email',
  'system.userForm.field.mobile': 'Mobile',
  'system.userForm.field.roleIds': 'Initial roles',
  'system.userForm.placeholder.username':
    '3-64 letters/digits/underscore/dot/hyphen',
  'system.userForm.placeholder.password': '8-64 characters',
  'system.userForm.placeholder.dept': 'Unassigned',
  'system.userForm.placeholder.roleIds': 'No roles',
  'system.userForm.extra.deptEdit':
    'Changing the department is treated as a transfer: all effective grants obtained via approval will be revoked',
  'system.userForm.extra.deptCreate': 'Leave empty = no department',
  'system.userForm.extra.emailEdit':
    'Leave empty = unchanged (conservative server policy; email cannot be cleared)',
  'system.userForm.extra.mobileEdit': 'Leave empty = unchanged',
  'system.userForm.extra.roleIds':
    'Optional. When your data scope is not "All", you can only assign roles you already hold (requires {perm}).',
  'system.userForm.rule.usernameRequired': 'Please enter the login account',
  'system.userForm.rule.usernamePattern':
    'Must be 3-64 letters/digits/underscore/dot/hyphen',
  'system.userForm.rule.passwordRequired': 'Please enter the initial password',
  'system.userForm.rule.passwordLength': 'Password must be 8-64 characters',
  'system.userForm.rule.nicknameRequired': 'Please enter a nickname',
  'system.userForm.rule.nicknameMax': 'No more than 64 characters',
  'system.userForm.rule.emailInvalid': 'Invalid email format',
  'system.userForm.rule.emailMax': 'No more than 128 characters',
  'system.userForm.rule.mobileMax': 'No more than 32 characters',
  'system.userForm.rule.remarkMax': 'No more than 255 characters',
  'system.userForm.message.updated': 'User profile updated',
  'system.userForm.message.created': 'User created',
  'system.userForm.roleOption': '{name} ({code} · {scope})',

  // Reset password modal
  'system.resetPassword.title': 'Reset password · {name}',
  'system.resetPassword.ok': 'Confirm reset',
  'system.resetPassword.alert.title':
    'All active sessions of this user will be revoked immediately after reset',
  'system.resetPassword.alert.desc':
    'The user must sign in again with the new password; administrators cannot view the original password (only a hash is stored).',
  'system.resetPassword.field.newPassword': 'New password',
  'system.resetPassword.field.confirmPassword': 'Confirm new password',
  'system.resetPassword.placeholder.password': '8-64 characters',
  'system.resetPassword.rule.newRequired': 'Please enter the new password',
  'system.resetPassword.rule.length': 'Password must be 8-64 characters',
  'system.resetPassword.rule.confirmRequired':
    'Please enter the new password again',
  'system.resetPassword.rule.mismatch': 'The two passwords do not match',
  'system.resetPassword.message.done':
    'Password reset; all active sessions of this user have been revoked',

  // Assign roles drawer
  'system.assignRole.title': 'Assign roles · {name}',
  'system.assignRole.alert.protected.title': 'Protected account',
  'system.assignRole.alert.protected.desc':
    'The super administrator role must be kept; removing it will be rejected by the server.',
  'system.assignRole.alert.mode.title':
    'Full replacement + keep at least one role',
  'system.assignRole.alert.mode.desc':
    'The submitted set replaces the previous one (not incremental). The server requires a non-empty role set, so select at least one.',
  'system.assignRole.searchPlaceholder': 'Filter by role name / code',
  'system.assignRole.empty.noOptions':
    'No assignable roles (possibly limited by data scope)',
  'system.assignRole.empty.noMatch': 'No matching roles',
  'system.assignRole.atLeastOne':
    'Select at least one role: the server enforces a non-empty role set.',
  'system.assignRole.message.done': 'Roles updated',

  // Role management page
  'system.role.title': 'Role management',
  'system.role.subtitle': 'Roles and permission matrix',
  'system.role.alertBoundary':
    'Built-in roles cannot be deleted and their data scope cannot be changed; system-management permission points are granted only to the super administrator. When your data scope is not "All", new roles can only be granted a data scope no higher than your own, and you can only check permission points you already hold (the server guards against privilege escalation).',
  'system.role.column.keyword': 'Role name / code',
  'system.role.column.keywordPlaceholder': 'Name or code, fuzzy match',
  'system.role.column.name': 'Role name',
  'system.role.column.code': 'Code',
  'system.role.column.dataScope': 'Data scope',
  'system.role.column.permissionSet': 'Permission set',
  'system.role.builtInTag': 'Built-in',
  'system.role.lockedTag': 'Locked (read-only)',
  'system.role.maintainableTag': 'Maintainable',
  'system.role.action.assignPerm': 'Assign permissions',
  'system.role.action.create': 'New role',
  'system.role.confirm.deleteTitle': 'Delete this role?',
  'system.role.confirm.deleteDesc':
    'Built-in roles, roles with associated permissions, or roles still held by users will be rejected by the server.',
  'system.role.message.deleted': 'Deleted role {name}',

  // Role create / edit modal
  'system.roleForm.title.edit': 'Edit role · {name}',
  'system.roleForm.title.create': 'New role',
  'system.roleForm.alert.title': 'Built-in role',
  'system.roleForm.alert.desc':
    'The code and data scope cannot be modified; only the name and remark are editable. The permission matrix is maintained in the "Assign permissions" drawer.',
  'system.roleForm.field.code': 'Role code',
  'system.roleForm.field.name': 'Role name',
  'system.roleForm.field.dataScope': 'Data scope',
  'system.roleForm.placeholder.code': 'e.g. DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    "The code is the role's external identifier and cannot be changed after creation",
  'system.roleForm.extra.dataScopeBuiltIn':
    'The data scope of a built-in role cannot be changed',
  'system.roleForm.extra.dataScopeMax':
    'Must not exceed your own data scope (current: {scope})',
  'system.roleForm.rule.codeRequired': 'Please enter the role code',
  'system.roleForm.rule.codePattern':
    'Must start with an uppercase letter and contain only uppercase letters/digits/underscore',
  'system.roleForm.rule.nameRequired': 'Please enter the role name',
  'system.roleForm.rule.nameMax': 'No more than 64 characters',
  'system.roleForm.rule.dataScopeRequired': 'Please select a data scope',
  'system.roleForm.message.updated': 'Role updated',
  'system.roleForm.message.created': 'Role created',

  // Role permission drawer
  'system.rolePerm.title': 'Assign permissions · {name}',
  'system.rolePerm.alert.locked.title':
    "The auditor role's permission set is locked",
  'system.rolePerm.alert.locked.desc':
    "The service layer rejects any change to this role's permission set (1021); this drawer is read-only.",
  'system.rolePerm.alert.readOnly.title': 'Read-only',
  'system.rolePerm.alert.readOnly.desc':
    'You do not have the role-assignment permission point (system:role:assign-perm); you can only view the current permission matrix.',
  'system.rolePerm.alert.selfLock.title':
    'Anti-self-lock: three permission points cannot be removed',
  'system.rolePerm.alert.selfLock.desc':
    'You must keep {codes}, otherwise nobody will be able to manage permissions again and the server will reject the change.',
  'system.rolePerm.alert.narrow.title':
    'Anti-escalation: you can only grant permission points you already hold',
  'system.rolePerm.alert.narrow.desc':
    'Your data scope is not "All"; nodes marked "Not grantable" will be rejected by the server on submit.',
  'system.rolePerm.tooltip.required':
    'Anti-self-lock: the super administrator must keep this "management entry point"; the server will reject its removal',
  'system.rolePerm.tooltip.notHeld':
    'Your data scope is not "All"; you cannot grant permission points you do not hold (server anti-escalation)',
  'system.rolePerm.tag.required': 'Required',
  'system.rolePerm.tag.notHeld': 'Not grantable',
  'system.rolePerm.selected': 'Selected {selected} / {total} permission points',
  'system.rolePerm.parentNote': '(parent nodes count = visible entry)',
  'system.rolePerm.empty': 'The permission point directory is empty',
  'system.rolePerm.message.mustKeep':
    'The super administrator role must keep these permission points: {codes}',
  'system.rolePerm.message.done': 'Role permissions updated',

  // Menu / permission point directory (read-only)
  'system.menu.title': 'Menu / permission point directory',
  'system.menu.subtitle': 'Permission model status (read-only)',
  'system.menu.alert.title':
    'Read-only page: permission points are maintained by SQL migration scripts',
  'system.menu.alert.desc':
    'This project models both "menus" and "actions" as permission points (type: 1-menu 2-action 3-data scope). Only a directory read endpoint (GET /api/v1/permission-points) exists; there is no permission point maintenance API. To check permissions for a role, go to "Role management → Assign permissions".',
  'system.menu.column.permName': 'Permission name',
  'system.menu.column.permCode': 'Permission code',
  'system.menu.column.type': 'Type',
  'system.menu.column.sortNo': 'Order',
  'system.menu.stat.total': 'Total permission points',
  'system.menu.stat.menu': 'Menu nodes',
  'system.menu.stat.action': 'Action nodes',
  'system.menu.stat.scope': 'Data scope nodes',
  'system.menu.headerTitle': 'Permission point tree',
  'system.menu.searchPlaceholder': 'Filter by name / code',
  'system.menu.empty.noPerm':
    'Missing permission: requires system:role:list or system:role:assign-perm',

  // Group management (placeholder)
  'system.group.title': 'Group management',
  'system.group.subtitle': 'Not available yet',
  'system.group.alert.title':
    'Group management APIs are not available yet; this page is a placeholder',
  'system.group.alert.desc':
    'The tables sys_group / sys_group_member already exist, but the server has no corresponding management controller or permission points. To avoid offering entries that are bound to fail, no create/update/delete operations are provided and no mock data is rendered.',
  'system.group.section.current.title': 'Current state',
  'system.group.section.current.subtitle':
    'Tables, server entities and permission points',
  'system.group.section.endpoints.title': 'Endpoints needed',
  'system.group.section.endpoints.subtitle': 'Backlog checklist',
  'system.group.desc.table': 'Tables',
  'system.group.desc.entity': 'Server entity',
  'system.group.entity.note':
    'Used only inside the collaboration domain (access checks), no external CRUD',
  'system.group.desc.perm': 'Permission points',
  'system.group.perm.none':
    'No system:group:* permission points (V9 defines only system:user:* and system:role:*)',
  'system.group.desc.availability': 'Current availability',
  'system.group.availability.readonly': 'Read-only, unavailable (no API)',
  'system.group.column.method': 'Method',
  'system.group.column.path': 'Path',
  'system.group.column.purpose': 'Purpose',
  'system.group.endpoint.groups.page': 'Paginated group list / keyword search',
  'system.group.endpoint.groups.detail': 'Group details',
  'system.group.endpoint.groups.create': 'Create group',
  'system.group.endpoint.groups.update': 'Edit group (name / remark / owner)',
  'system.group.endpoint.groups.remove': 'Delete group',
  'system.group.endpoint.members.list': 'Member list',
  'system.group.endpoint.members.replace': 'Full replacement of members',

  // Department management (read-only)
  'system.dept.title': 'Department management',
  'system.dept.subtitle': 'Organization structure (read-only)',
  'system.dept.alert.title':
    'Read-only page: department create/update/delete APIs are not available yet',
  'system.dept.alert.desc':
    'The only available department endpoint is GET /api/v1/system/users/dept-options (used by the user form dropdown and data scope evaluation). This page presents the organization structure faithfully and offers no write operations that cannot be fulfilled. Department IDs are also used for user transfers and data scope calculation, so confirm the impact before adjusting.',
  'system.dept.column.name': 'Department name',
  'system.dept.column.id': 'Department ID',
  'system.dept.column.parentId': 'Parent department ID',
  'system.dept.column.depth': 'Level',
  'system.dept.column.childCount': 'Sub-departments',
  'system.dept.depthValue': 'Level {depth}',
  'system.dept.rootTag': 'Root',
  'system.dept.stat.total': 'Total departments',
  'system.dept.stat.roots': 'Root departments',
  'system.dept.stat.maxDepth': 'Max depth',
  'system.dept.stat.rootsFooter': 'Top-level nodes without a parent department',
  'system.dept.suffix.count': '',
  'system.dept.suffix.level': '',
  'system.dept.headerTitle': 'Department list',
  'system.dept.message.reloaded': 'Department list reloaded',
} as const;
