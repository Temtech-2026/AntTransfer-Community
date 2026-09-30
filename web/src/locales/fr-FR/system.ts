/** Textes de l'administration système (utilisateurs / rôles / services / groupes / autorisations de menu). */
export default {
  // Actions / noms de colonnes du domaine système réutilisés entre les pages
  'system.action.edit': 'Modifier',
  'system.action.delete': 'Supprimer',
  'system.action.create': 'Créer',
  'system.column.action': 'Actions',
  'system.column.status': 'État',
  'system.column.remark': 'Remarque',
  'system.column.createTime': 'Date de création',
  'system.alert.boundaryTitle': 'Limites des opérations',

  // État de l'utilisateur
  'system.userStatus.normal': 'Normal',
  'system.userStatus.disabled': 'Désactivé',
  'system.userStatus.locked': 'Verrouillé',
  'system.userStatus.unknown': 'Inconnu',

  // Périmètre de données
  'system.dataScope.self': 'Soi-même uniquement',
  'system.dataScope.deptAndSub': 'Service et sous-services',
  'system.dataScope.all': 'Tous',
  'system.dataScope.unknown': 'Inconnu ({scope})',

  // Dimension du point d'autorisation
  'system.permType.menu': 'Menu',
  'system.permType.action': 'Action',
  'system.permType.dataScope': 'Périmètre de données',
  'system.permType.unknown': 'Inconnu ({type})',

  // Page de gestion des utilisateurs
  'system.user.title': 'Gestion des utilisateurs',
  'system.user.subtitle': 'Comptes, services, états et rattachement des rôles',
  'system.user.alertBoundary':
    "Les comptes protégés ne peuvent être ni désactivés, ni supprimés, ni voir leurs rôles modifiés ; un administrateur ne peut pas se désactiver, réinitialiser son mot de passe, s'attribuer des rôles ou se supprimer lui-même (le serveur le refuse, y compris en prévention de l'escalade de privilèges). Lorsque le périmètre de données est restreint, la liste et le sélecteur de rôles se restreignent automatiquement.",
  'system.user.column.keyword': 'Compte / pseudo',
  'system.user.column.keywordPlaceholder':
    'Compte ou pseudo, recherche approximative',
  'system.user.column.username': 'Compte',
  'system.user.column.nickname': 'Pseudo',
  'system.user.column.dept': 'Service',
  'system.user.column.deptPlaceholder': 'Tous les services visibles',
  'system.user.column.roles': 'Rôles',
  'system.user.column.lastLogin': 'Dernière connexion',
  'system.user.protectedTag': 'Protégé',
  'system.user.action.assignRole': 'Attribuer des rôles',
  'system.user.action.resetPassword': 'Réinitialiser le mot de passe',
  'system.user.action.disable': 'Désactiver',
  'system.user.action.enable': 'Activer',
  'system.user.action.locked': 'Verrouillé',
  'system.user.action.create': 'Créer un utilisateur',
  'system.user.confirm.disableTitle':
    'Confirmer la désactivation de ce compte ?',
  'system.user.confirm.enableTitle': "Confirmer l'activation de ce compte ?",
  'system.user.confirm.disableDesc':
    'Après désactivation, toutes les sessions actives de ce compte sont immédiatement invalidées.',
  'system.user.confirm.deleteTitle':
    'Confirmer la suppression de cet utilisateur ?',
  'system.user.confirm.deleteDesc':
    'La suppression est irréversible ; les comptes protégés ou encore référencés seront refusés par le serveur.',
  'system.user.message.disabled': '{name} désactivé',
  'system.user.message.enabled': '{name} activé',
  'system.user.message.deleted': '{name} supprimé',

  // Avatar (canal dédié : prise d'effet immédiate, hors enregistrement du formulaire d'édition)
  'system.user.avatar.label': 'Avatar',
  'system.user.avatar.upload': 'Téléverser un avatar',
  'system.user.avatar.hint':
    "Formats pris en charge : PNG / JPEG / GIF / WebP, jusqu'à {max}",
  'system.user.avatar.updated': 'Avatar mis à jour',
  'system.user.avatar.tooLarge': "L'image ne doit pas dépasser {max}",
  'system.user.avatar.typeInvalid':
    'Seules les images PNG / JPEG / GIF / WebP sont prises en charge',
  // Fenêtre de création / édition d'utilisateur
  'system.userForm.title.edit': "Modifier l'utilisateur · {name}",
  'system.userForm.title.create': 'Créer un utilisateur',
  'system.userForm.alert.title':
    "Le nom de compte, l'état, les rôles et le mot de passe ne figurent pas dans ce formulaire",
  'system.userForm.alert.desc':
    "Le nom de compte n'est pas modifiable ; utilisez les boutons correspondants dans la liste pour l'état, le mot de passe et les rôles. La remarque n'étant pas renvoyée par l'API, son édition n'est pas disponible pour l'instant.",
  'system.userForm.field.username': 'Compte de connexion',
  'system.userForm.field.password': 'Mot de passe initial',
  'system.userForm.field.nickname': 'Pseudo / nom',
  'system.userForm.field.dept': 'Service de rattachement',
  'system.userForm.field.email': 'E-mail',
  'system.userForm.field.mobile': 'Téléphone mobile',
  'system.userForm.field.roleIds': 'Rôles initiaux',
  'system.userForm.placeholder.username':
    '3 à 64 lettres/chiffres/underscore/points/tirets',
  'system.userForm.placeholder.password': '8 à 64 caractères',
  'system.userForm.placeholder.dept': 'Non attribué',
  'system.userForm.placeholder.roleIds': 'Aucun rôle attribué',
  'system.userForm.extra.deptEdit':
    'Modifier le service équivaut à une mutation : toutes les autorisations actives de cet utilisateur « obtenues par approbation » seront révoquées',
  'system.userForm.extra.deptCreate': 'Vide = aucun service attribué',
  'system.userForm.extra.emailEdit':
    "Vide = aucune modification (stratégie prudente du serveur : l'e-mail ne peut pas être effacé)",
  'system.userForm.extra.mobileEdit': 'Vide = aucune modification',
  'system.userForm.extra.roleIds':
    "Peut rester vide. Si le périmètre de données n'est pas « Tous », seuls les rôles déjà détenus peuvent être attribués (nécessite {perm}).",
  'system.userForm.rule.usernameRequired':
    'Veuillez saisir le compte de connexion',
  'system.userForm.rule.usernamePattern':
    'Doit comporter 3 à 64 lettres/chiffres/underscore/points/tirets',
  'system.userForm.rule.passwordRequired':
    'Veuillez saisir le mot de passe initial',
  'system.userForm.rule.passwordLength':
    'Le mot de passe doit comporter 8 à 64 caractères',
  'system.userForm.rule.nicknameRequired': 'Veuillez saisir le pseudo',
  'system.userForm.rule.nicknameMax': '64 caractères maximum',
  'system.userForm.rule.emailInvalid': "Format d'e-mail incorrect",
  'system.userForm.rule.emailMax': '128 caractères maximum',
  'system.userForm.rule.mobileMax': '32 caractères maximum',
  'system.userForm.rule.remarkMax': '255 caractères maximum',
  'system.userForm.message.updated': 'Profil utilisateur mis à jour',
  'system.userForm.message.created': 'Utilisateur créé',
  'system.userForm.roleOption': '{name} ({code} · {scope})',

  // Fenêtre de réinitialisation du mot de passe
  'system.resetPassword.title': 'Réinitialiser le mot de passe · {name}',
  'system.resetPassword.ok': 'Confirmer la réinitialisation',
  'system.resetPassword.alert.title':
    'Après réinitialisation, toutes les sessions actives de cet utilisateur sont immédiatement invalidées',
  'system.resetPassword.alert.desc':
    "L'utilisateur devra se reconnecter avec le nouveau mot de passe ; l'administrateur ne peut pas consulter l'ancien (seule son empreinte est stockée en base).",
  'system.resetPassword.field.newPassword': 'Nouveau mot de passe',
  'system.resetPassword.field.confirmPassword':
    'Confirmer le nouveau mot de passe',
  'system.resetPassword.placeholder.password': '8 à 64 caractères',
  'system.resetPassword.rule.newRequired':
    'Veuillez saisir le nouveau mot de passe',
  'system.resetPassword.rule.length':
    'Le mot de passe doit comporter 8 à 64 caractères',
  'system.resetPassword.rule.confirmRequired':
    'Veuillez saisir à nouveau le nouveau mot de passe',
  'system.resetPassword.rule.mismatch':
    'Les deux mots de passe saisis ne correspondent pas',
  'system.resetPassword.message.done':
    'Mot de passe réinitialisé ; toutes les sessions actives de cet utilisateur ont été invalidées',

  // Volet d'attribution des rôles
  'system.assignRole.title': 'Attribuer des rôles · {name}',
  'system.assignRole.alert.protected.title': 'Compte protégé',
  'system.assignRole.alert.protected.desc':
    'Le rôle de super-administrateur doit être conservé ; son retrait sera refusé par le serveur.',
  'system.assignRole.alert.mode.title':
    "Remplacement de l'ensemble + conservation d'au moins un rôle",
  'system.assignRole.alert.mode.desc':
    "La soumission remplace l'ensemble selon les cases cochées (pas d'ajout incrémental). Le serveur exige un ensemble de rôles non vide ; cochez donc au moins un rôle.",
  'system.assignRole.searchPlaceholder': 'Filtrer par nom / code de rôle',
  'system.assignRole.empty.noOptions':
    'Aucun rôle attribuable (éventuellement en raison du périmètre de données restreint)',
  'system.assignRole.empty.noMatch': 'Aucun rôle correspondant',
  'system.assignRole.atLeastOne':
    "Cochez au moins un rôle : le serveur vérifie que l'ensemble des rôles n'est pas vide.",
  'system.assignRole.message.done': 'Rôles mis à jour',
  // Page de gestion des rôles
  'system.role.title': 'Gestion des rôles',
  'system.role.subtitle': "Entités de rôle et matrice d'autorisations",
  'system.role.alertBoundary':
    "Les rôles intégrés ne peuvent être ni supprimés ni voir leur périmètre de données modifié ; les points d'autorisation de l'administration système ne sont accordés qu'au super-administrateur. Si le périmètre de données n'est pas « Tous », la création de rôles ne permet d'accorder qu'un périmètre inférieur ou égal au sien, et l'attribution d'autorisations ne permet de cocher que les points déjà détenus (garde-fou anti-escalade du serveur).",
  'system.role.column.keyword': 'Nom / code du rôle',
  'system.role.column.keywordPlaceholder':
    'Nom ou code, recherche approximative',
  'system.role.column.name': 'Nom du rôle',
  'system.role.column.code': 'Code',
  'system.role.column.dataScope': 'Périmètre de données',
  'system.role.column.permissionSet': "Ensemble d'autorisations",
  'system.role.builtInTag': 'Intégré',
  'system.role.lockedTag': 'Verrouillé en lecture seule',
  'system.role.maintainableTag': 'Modifiable',
  'system.role.action.assignPerm': 'Attribuer des autorisations',
  'system.role.action.create': 'Créer un rôle',
  'system.role.confirm.deleteTitle': 'Confirmer la suppression de ce rôle ?',
  'system.role.confirm.deleteDesc':
    "Les rôles intégrés, dotés d'autorisations associées ou encore détenus par des utilisateurs seront refusés par le serveur.",
  'system.role.message.deleted': 'Rôle {name} supprimé',

  // Fenêtre de création / édition de rôle
  'system.roleForm.title.edit': 'Modifier le rôle · {name}',
  'system.roleForm.title.create': 'Créer un rôle',
  'system.roleForm.alert.title': 'Rôle intégré',
  'system.roleForm.alert.desc':
    "Le code et le périmètre de données ne sont pas modifiables ; seuls le nom et la remarque peuvent être ajustés. La matrice d'autorisations se gère dans le volet « Attribuer des autorisations ».",
  'system.roleForm.field.code': 'Code du rôle',
  'system.roleForm.field.name': 'Nom du rôle',
  'system.roleForm.field.dataScope': 'Périmètre de données',
  'system.roleForm.placeholder.code': 'Par exemple DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    "Le code est l'identifiant externe du rôle ; il n'est pas modifiable après la création",
  'system.roleForm.extra.dataScopeBuiltIn':
    "Le périmètre de données d'un rôle intégré n'est pas modifiable",
  'system.roleForm.extra.dataScopeMax':
    'Ne doit pas dépasser votre propre périmètre de données (actuel : {scope})',
  'system.roleForm.rule.codeRequired': 'Veuillez saisir le code du rôle',
  'system.roleForm.rule.codePattern':
    'Doit commencer par une majuscule et ne contenir que des majuscules/chiffres/underscores',
  'system.roleForm.rule.nameRequired': 'Veuillez saisir le nom du rôle',
  'system.roleForm.rule.nameMax': '64 caractères maximum',
  'system.roleForm.rule.dataScopeRequired':
    'Veuillez choisir le périmètre de données',
  'system.roleForm.message.updated': 'Rôle mis à jour',
  'system.roleForm.message.created': 'Rôle créé',

  // Volet d'attribution des autorisations de rôle
  'system.rolePerm.title': 'Attribuer des autorisations · {name}',
  'system.rolePerm.alert.locked.title':
    "L'ensemble d'autorisations du rôle d'auditeur est verrouillé",
  'system.rolePerm.alert.locked.desc':
    "La couche service refuse toute modification de l'ensemble d'autorisations de ce rôle (1021) ; ce volet est en lecture seule.",
  'system.rolePerm.alert.readOnly.title': 'Lecture seule',
  'system.rolePerm.alert.readOnly.desc':
    "Vous ne disposez pas du point d'autorisation d'attribution de rôle (system:role:assign-perm) ; vous pouvez seulement consulter la matrice d'autorisations actuelle.",
  'system.rolePerm.alert.selfLock.title':
    "Anti-verrouillage : trois points d'autorisation ne peuvent pas être retirés",
  'system.rolePerm.alert.selfLock.desc':
    '{codes} doivent être conservés, faute de quoi plus personne ne pourra gérer les autorisations ; le serveur refusera directement.',
  'system.rolePerm.alert.narrow.title':
    "Anti-escalade : seuls les points d'autorisation déjà détenus peuvent être accordés",
  'system.rolePerm.alert.narrow.desc':
    "Votre périmètre de données n'est pas « Tous » ; les nœuds marqués « Non accordable » seront refusés par le serveur à la soumission.",
  'system.rolePerm.tooltip.required':
    "Anti-verrouillage : le super-administrateur doit conserver cette « porte d'entrée vers la capacité d'administration » ; le serveur refusera son retrait",
  'system.rolePerm.tooltip.notHeld':
    "Votre périmètre de données n'est pas « Tous » ; vous ne pouvez pas accorder un point d'autorisation que vous ne détenez pas (anti-escalade du serveur)",
  'system.rolePerm.tag.required': 'Obligatoire',
  'system.rolePerm.tag.notHeld': 'Non accordable',
  'system.rolePerm.selected':
    "{selected} sélectionnés / {total} points d'autorisation",
  'system.rolePerm.parentNote':
    '(le nœud parent est compté comme entrée visible)',
  'system.rolePerm.empty': "Le répertoire des points d'autorisation est vide",
  'system.rolePerm.message.mustKeep':
    "Le rôle de super-administrateur doit conserver ces points d'autorisation : {codes}",
  'system.rolePerm.message.done': 'Autorisations du rôle mises à jour',
  // Répertoire des menus / points d'autorisation (lecture seule)
  'system.menu.title': "Répertoire des menus / points d'autorisation",
  'system.menu.subtitle':
    "État actuel du modèle d'autorisations (lecture seule)",
  'system.menu.alert.title':
    "Page en lecture seule : la création, la modification et la suppression des points d'autorisation sont gérées par les scripts de migration SQL",
  'system.menu.alert.desc':
    "Ce projet modélise de façon unifiée les « menus » et les « actions » comme des points d'autorisation (type : 1-menu 2-action 3-périmètre de données). Seul un point d'accès en lecture du répertoire existe actuellement (GET /api/v1/permission-points), sans API de maintenance des points d'autorisation. Pour cocher des autorisations pour un rôle, rendez-vous dans « Gestion des rôles → Attribuer des autorisations ».",
  'system.menu.column.permName': "Nom du point d'autorisation",
  'system.menu.column.permCode': "Code d'autorisation",
  'system.menu.column.type': 'Dimension',
  'system.menu.column.sortNo': 'Ordre',
  'system.menu.stat.total': "Total des points d'autorisation",
  'system.menu.stat.menu': 'Nœuds de menu',
  'system.menu.stat.action': "Nœuds d'action",
  'system.menu.stat.scope': 'Nœuds de périmètre de données',
  'system.menu.headerTitle': "Arborescence des points d'autorisation",
  'system.menu.searchPlaceholder': 'Filtrer par nom / code',
  'system.menu.empty.noPerm':
    'Autorisation manquante : system:role:list ou system:role:assign-perm requis',

  // Gestion des groupes (texte de remplacement)
  'system.group.title': 'Gestion des groupes',
  'system.group.subtitle': 'Pas encore disponible',
  'system.group.alert.title':
    "L'API de gestion des groupes n'est pas encore fournie ; cette page est un texte de remplacement",
  'system.group.alert.desc':
    "Les tables sys_group / sys_group_member existent, mais le serveur ne possède ni contrôleur de gestion ni point d'autorisation correspondants. Pour éviter des entrées qui échoueraient fatalement, aucune opération de création, modification ou suppression n'est proposée ici, et aucune donnée simulée n'est affichée.",
  'system.group.section.current.title': 'État actuel',
  'system.group.section.current.subtitle':
    "Tables, entités serveur et points d'autorisation",
  'system.group.section.endpoints.title': 'API à compléter',
  'system.group.section.endpoints.subtitle': 'Liste de planification',
  'system.group.desc.table': 'Tables',
  'system.group.desc.entity': 'Entité serveur',
  'system.group.entity.note':
    "Usage interne au domaine collaboration uniquement (décision d'accès), sans CRUD exposé",
  'system.group.desc.perm': "Points d'autorisation",
  'system.group.perm.none':
    "Aucun point d'autorisation system:group:* (V9 ne définit que system:user:* et system:role:*)",
  'system.group.desc.availability': 'Disponibilité actuelle',
  'system.group.availability.readonly':
    'Lecture seule, indisponible (aucune API)',
  'system.group.column.method': 'Méthode',
  'system.group.column.path': 'Chemin',
  'system.group.column.purpose': 'Objet',
  'system.group.endpoint.groups.page':
    'Pagination des groupes / recherche par mot-clé',
  'system.group.endpoint.groups.detail': 'Détail du groupe',
  'system.group.endpoint.groups.create': 'Créer un groupe',
  'system.group.endpoint.groups.update':
    'Modifier le groupe (nom / remarque / responsable)',
  'system.group.endpoint.groups.remove': 'Supprimer le groupe',
  'system.group.endpoint.members.list': 'Liste des membres',
  'system.group.endpoint.members.replace': "Remplacer l'ensemble des membres",

  // Gestion des services (lecture seule)
  'system.dept.title': 'Gestion des services',
  'system.dept.subtitle': 'Organigramme (lecture seule)',
  'system.dept.alert.title':
    "Page en lecture seule : l'API de création, modification ou suppression de service n'est pas encore fournie",
  'system.dept.alert.desc':
    "Le seul point d'accès de service disponible est GET /api/v1/system/users/dept-options (pour la liste déroulante du formulaire utilisateur et la détermination du périmètre de données). Cette page présente l'organigramme tel quel, sans opération d'écriture non applicable. L'ID de service sert à la fois à la « mutation d'un utilisateur » et au calcul du périmètre de données ; vérifiez les impacts avant tout ajustement.",
  'system.dept.column.name': 'Nom du service',
  'system.dept.column.id': 'ID du service',
  'system.dept.column.parentId': 'ID du service parent',
  'system.dept.column.depth': 'Niveau',
  'system.dept.column.childCount': 'Nombre de sous-services',
  'system.dept.depthValue': 'Niveau {depth}',
  'system.dept.rootTag': 'Racine',
  'system.dept.stat.total': 'Total des services',
  'system.dept.stat.roots': 'Services racines',
  'system.dept.stat.maxDepth': 'Niveau maximal',
  'system.dept.stat.rootsFooter': 'Nœuds de premier niveau sans service parent',
  'system.dept.suffix.count': ' services',
  'system.dept.suffix.level': ' niveaux',
  'system.dept.headerTitle': 'Liste des services',
  'system.dept.message.reloaded': 'Liste des services rechargée',
} as const;
