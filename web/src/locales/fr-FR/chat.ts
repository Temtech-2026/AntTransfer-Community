/** Textes de la page de discussion (liste des conversations + fenêtre de discussion). */
export default {
  'chat.title': 'Discussion',
  'chat.subtitle':
    'Conversations individuelles / de groupe, envoi et réception en temps réel',

  'chat.action.refresh': 'Actualiser',
  'chat.action.new': 'Nouvelle conversation',
  'chat.action.send': 'Envoyer',

  'chat.list.title': 'Conversations',
  'chat.search.placeholder': 'Rechercher une conversation',
  'chat.list.empty.title': 'Aucune conversation pour le moment',
  'chat.list.empty.desc':
    'Cliquez sur « Nouvelle conversation » pour choisir un collègue et démarrer une discussion, ou saisissez un identifiant de groupe pour lancer une conversation de groupe',
  'chat.list.emptyFiltered.title': 'Aucune conversation correspondante',
  'chat.list.emptyFiltered.desc': 'Essayez un autre mot-clé',

  'chat.session.groupFallback': 'Conversation de groupe #{id}',
  'chat.session.userFallback': 'Utilisateur #{id}',
  'chat.tag.private': 'Discussion',
  'chat.tag.group': 'Groupe',
  'chat.sender.mine': 'Moi',

  // Accusé de lecture : texte d\'accessibilité de la rangée d\'avatars des lecteurs sous la bulle
  // (une information purement iconographique doit toujours avoir un équivalent textuel)
  'chat.read.by': 'Lu par : {names}',
  'chat.read.more': '{count} autre(s) personne(s) ont lu',

  // Menu contextuel d\'un message : retrait (uniquement ses propres messages, dans les 2 minutes)
  // et citation (répondre à un message précis)
  'chat.message.action.quote': 'Citer',
  'chat.message.action.recall': 'Retirer',
  // Texte de remplacement de la bulle après retrait : indiquer « qui » a retiré plutôt que
  // seulement « message retiré », sinon en groupe on croit que c\'est soi-même
  'chat.message.recalled.mine': 'Vous avez retiré un message',
  'chat.message.recalled.other': '{name} a retiré un message',
  'chat.message.recall.success': 'Message retiré',
  'chat.message.recall.failed':
    'Échec du retrait, veuillez réessayer plus tard',

  // Bandeau « en cours de citation » affiché au-dessus de la zone de saisie
  'chat.composer.quote.cancel': 'Annuler la citation',

  // Statut de l\'interlocuteur : la page de discussion et le tiroir partagent le même composant,
  // les textes n\'appartiennent à aucun des deux
  // Les trois états doivent être accompagnés de texte : un simple point vert/gris/rouge ne
  // transmet aucune information aux utilisateurs daltoniens ou en mode contraste élevé
  'chat.presence.online': 'En ligne',
  'chat.presence.offline': 'Hors ligne',
  'chat.presence.unstable': 'Connexion instable',
  // Partagé avec les trois états ci-dessus : lorsque l\'interlocuteur écrit, cette information
  // est plus instantanée qu\'un statut statique
  'chat.typing': "L'interlocuteur est en train d'écrire…",

  // Qualité de notre propre connexion (toujours visible dans l'en-tête du chat) :
  // à ne pas confondre avec la présence de l'interlocuteur ci-dessus
  'chat.connection.open': 'Connexion temps réel OK',
  'chat.connection.connecting': 'Connexion…',
  'chat.connection.reconnecting': 'Reconnexion…',
  'chat.connection.closed': 'Connexion fermée',
  'chat.connection.idle': 'Non connecté',

  'chat.stream.placeholder.title':
    'Sélectionnez une conversation à gauche pour discuter',
  'chat.stream.placeholder.desc':
    "L'historique est synchronisé en temps réel ; les messages reçus pendant une déconnexion sont rattrapés à la reconnexion",
  'chat.stream.empty.title': 'Aucun message pour le moment',
  'chat.stream.empty.desc': 'Envoyez un premier message pour dire bonjour',
  'chat.stream.loadMore': 'Charger les messages plus anciens',
  'chat.stream.loadingMore': 'Chargement…',
  'chat.stream.noMore': 'Aucun message plus ancien',
  'chat.stream.loadMoreFailed':
    'Échec du chargement des messages plus anciens, veuillez réessayer',
  // Comportement de la zone de saisie aligné sur WeChat : Enter envoie, Shift + Enter passe à la ligne
  'chat.composer.placeholder':
    'Saisissez un message, Enter pour envoyer, Shift + Enter pour passer à la ligne',
  'chat.composer.empty': 'Le contenu du message ne peut pas être vide',
  'chat.composer.sendHint':
    'Enter pour envoyer, Shift + Enter pour passer à la ligne',
  'chat.composer.emoji': 'Émoticônes',
  'chat.composer.emojiPanel': "Catégories d'émoticônes",
  'chat.composer.group.recent': 'Récemment utilisées',
  'chat.composer.group.smileys': 'Émoticônes',
  'chat.composer.group.gestures': 'Gestes',
  'chat.composer.group.people': 'Personnes et humeurs',
  'chat.composer.group.animals': 'Animaux et nature',
  'chat.composer.group.food': 'Nourriture',
  'chat.composer.group.objects': 'Objets et activités',
  'chat.composer.group.symbols': 'Symboles',

  // Mention @ : l\'entrée n\'apparaît que dans les conversations de groupe
  // (une discussion n\'a pas de sémantique d\'interpellation, voir ChatComposer.mentionEnabled)
  'chat.composer.mention': 'Mentionner un membre',
  'chat.composer.mentionPanel': 'Membres mentionnables',
  'chat.composer.mentionEmpty': 'Aucun membre correspondant',
  // « On m\'a mentionné » : le préfixe du résumé dans la liste des conversations, la mise en
  // évidence du badge et le marqueur sur la bulle partagent la même phrase
  'chat.mention.me': "On m'a mentionné",

  'chat.new.title': 'Nouvelle conversation',
  'chat.new.scope.label': 'Type de conversation',
  'chat.new.scope.private': 'Discussion',
  'chat.new.scope.group': 'Groupe',
  'chat.new.user.placeholder':
    'Saisissez un identifiant ou un pseudonyme pour rechercher',
  'chat.new.user.optionLabel': '{name} ({username})',
  'chat.new.user.resolveHint':
    "Saisissez l'identifiant de connexion de l'interlocuteur ; la vérification se fait automatiquement à la sortie du champ",
  'chat.new.user.resolved': 'Trouvé : {name}',
  'chat.new.user.notFound':
    'Aucun utilisateur disponible ne correspond à cet identifiant, veuillez vérifier puis réessayer',
  'chat.new.target.label': "Identifiant de connexion de l'interlocuteur",
  'chat.new.target.placeholder':
    "Saisissez l'identifiant de connexion de l'interlocuteur",
  'chat.new.target.required':
    "Veuillez d'abord choisir le destinataire de la conversation",
  'chat.new.target.accountRequired':
    "Veuillez d'abord saisir l'identifiant de connexion de l'interlocuteur",

  // Conversation de groupe : formulaire de création (nom du groupe + membres invités) et entrée
  // « Groupes auxquels je participe ». L\'ancien champ manuel « identifiant de groupe » a été
  // supprimé : ces groupes ne pouvaient pas être créés et leur identifiant était introuvable,
  // cette entrée ne menait nulle part pour personne
  'chat.new.group.nameLabel': 'Nom de la conversation de groupe',
  'chat.new.group.namePlaceholder':
    'Saisissez le nom de la conversation de groupe',
  'chat.new.group.nameRequired':
    "Veuillez d'abord saisir le nom de la conversation de groupe",
  'chat.new.group.memberLabel': 'Membres du groupe',
  'chat.new.group.memberPlaceholder':
    "Saisissez l'identifiant de connexion du membre, Entrée pour l'ajouter",
  'chat.new.group.memberHint':
    'Invitez au moins 1 membre ; {max} personnes au maximum, vous inclus',
  'chat.new.group.memberRequired':
    "Veuillez d'abord inviter au moins un membre du groupe",
  'chat.new.group.memberLimit': '{max} membres au maximum (vous inclus)',
  'chat.new.group.firstMessageFailed':
    "La conversation de groupe est créée, mais l'envoi du premier message a échoué ; renvoyez-le depuis la zone de discussion",
  'chat.new.group.existingLabel': 'Groupes auxquels je participe',
  'chat.new.group.existingPlaceholder':
    'Sélectionnez un groupe pour y accéder directement',
  'chat.new.group.optionLabel': '{name} ({count} personnes)',
  'chat.new.content.required':
    "Veuillez d'abord saisir le premier message (la conversation est créée après l'envoi)",
  'chat.new.content.label': 'Premier message',
  'chat.new.content.placeholder': 'Écrivez un mot pour dire bonjour',
  'chat.new.submit': 'Démarrer',
  'chat.new.cancel': 'Annuler',

  // Panneau de paramètres du groupe (la page /chat et le tiroir de messagerie instantanée
  // partagent le même composant, les textes n\'appartiennent à aucun des deux).
  // L\'affichage des boutons est la conjonction du « point d\'autorisation CHAT_PERM ∧ ability
  // transmise par le serveur », voir components/ChatGroupPanel
  'chat.group.title': 'Paramètres du groupe',
  'chat.group.close': 'Fermer',
  'chat.group.info': 'Informations du groupe',
  'chat.group.name.placeholder': 'Saisissez le nom du groupe',
  'chat.group.name.required': 'Le nom du groupe ne peut pas être vide',
  'chat.group.name.save': 'Enregistrer',
  'chat.group.name.success': 'Nom du groupe mis à jour',
  'chat.group.meta': '{count}/{max} personnes',
  'chat.group.members.label': 'Membres du groupe',
  'chat.group.emptyMembers': 'Aucun membre pour le moment',
  'chat.group.member.unknown': 'Membre inconnu',
  'chat.group.member.owner': 'Propriétaire du groupe',
  'chat.group.member.admin': 'Administrateur',
  'chat.group.member.readonly': 'Lecture seule',
  'chat.group.member.joinedAt': 'A rejoint le groupe le {time}',
  'chat.group.member.remove': 'Retirer',
  'chat.group.member.removeConfirmTitle':
    'Retirer {name} de la conversation de groupe ?',
  'chat.group.member.removeConfirmDesc':
    "Après le retrait, l'intéressé perd immédiatement l'accès en lecture à l'historique de ce groupe ; vous pouvez l'inviter à nouveau si besoin.",
  'chat.group.member.removed': '{name} a été retiré',
  'chat.group.invite.label': 'Inviter des membres',
  'chat.group.invite.placeholder':
    "Saisissez l'identifiant de connexion du membre, Entrée pour l'ajouter",
  'chat.group.invite.button': 'Inviter',
  'chat.group.invite.success': '{count} membre(s) invité(s)',
  'chat.group.invite.none':
    "Ces membres sont déjà dans le groupe, aucune invitation supplémentaire n'est nécessaire",
  'chat.group.invite.alreadyMember': '{name} est déjà dans le groupe',
  'chat.group.invite.noCandidate': 'Aucun identifiant disponible correspondant',
  'chat.group.invite.hint':
    'Vous pouvez encore inviter {count} personne(s) ({max} personnes au maximum)',
  'chat.group.invite.full':
    "Le groupe a atteint sa limite de membres ({max} personnes), impossible d'inviter davantage",
  'chat.group.invite.limit':
    "Vous pouvez inviter au maximum {count} personne(s) de plus ({max} personnes au maximum), veuillez réduire le nombre d'invitations",
  'chat.group.dangerZone': 'Opérations sensibles',
  'chat.group.quit': 'Quitter la conversation de groupe',
  'chat.group.quitConfirmTitle': 'Quitter cette conversation de groupe ?',
  'chat.group.quitConfirmDesc':
    "Après avoir quitté, vous ne recevrez plus les messages de ce groupe et l'historique ne sera plus accessible ; pour rejoindre à nouveau, une invitation du propriétaire du groupe ou d'un administrateur est nécessaire.",
  'chat.group.quit.success': 'Vous avez quitté la conversation de groupe',
  'chat.group.dissolve': 'Dissoudre la conversation de groupe',
  'chat.group.dissolveConfirmTitle': 'Dissoudre cette conversation de groupe ?',
  'chat.group.dissolveConfirmDesc':
    "Tous les membres perdront l'accès à ce groupe et l'historique ne sera plus lisible côté serveur.",
  'chat.group.dissolve.success': 'Conversation de groupe dissoute',
  'chat.group.loadFailed':
    "Les informations du groupe n'ont pas pu être chargées",

  // Panneau de profil de l\'interlocuteur (discussion) : il modifie le mémo privé « comment je
  // l\'appelle de mon côté », et non le pseudonyme du compte de l\'intéressé.
  // La page et le tiroir partagent le même composant, les textes n\'appartiennent à aucun des deux
  'chat.peer.title': "Profil de l'interlocuteur",
  'chat.peer.action': 'Mémo',
  'chat.peer.close': 'Fermer',
  'chat.peer.nickname.label': 'Pseudonyme : {name}',
  'chat.peer.alias.label': 'Mémo',
  'chat.peer.alias.placeholder':
    'Donnez à cette personne un nom dont vous vous souviendrez',
  'chat.peer.alias.hint':
    "Le mémo n'est visible que par vous ; l'interlocuteur ne le verra pas et le pseudonyme de son compte ne sera pas modifié pour autant.",
  'chat.peer.alias.save': 'Enregistrer',
  'chat.peer.alias.clear': 'Supprimer le mémo',
  'chat.peer.alias.saved': 'Mémo enregistré',
  'chat.peer.alias.cleared': 'Mémo supprimé',

  // Carte de fichier dans le flux de messages : la page de discussion et le tiroir partagent le
  // même composant, les textes n\'appartiennent à aucun des deux
  'chat.fileCard.open': 'Ouvrir {name} dans les fichiers',

  // Restrictions d\'usage des pièces jointes (l\'expéditeur définit trois axes : niveau d\'usage /
  // durée de validité / nombre de téléchargements)
  'chat.attach.policy.trigger': "Restrictions d'usage",
  'chat.attach.policy.title': 'Ce que le destinataire peut faire de ce fichier',
  'chat.attach.policy.usage.label': 'Usage',
  'chat.attach.usage.previewOnly': 'Aperçu uniquement',
  'chat.attach.usage.previewOnly.desc':
    'Consultation en ligne dans la conversation uniquement, téléchargement impossible',
  'chat.attach.usage.downloadable': 'Téléchargeable',
  'chat.attach.usage.downloadable.desc':
    "Téléchargeable, mais le fichier n'est pas enregistré dans les fichiers du destinataire",
  'chat.attach.usage.resavable': 'Transférable et enregistrable',
  'chat.attach.usage.resavable.desc':
    'Téléchargeable et peut être enregistré dans les fichiers du destinataire',
  'chat.attach.policy.expire.label': 'Durée de validité',
  'chat.attach.expire.days': '{days} jours',
  'chat.attach.expire.never': 'Sans limite',
  'chat.attach.policy.limit.label': 'Nombre maximal de téléchargements',
  'chat.attach.limit.unlimited': 'Illimité',
  'chat.attach.limit.times': '{count} fois',
  'chat.attach.policy.limit.disabledHint':
    "L'aperçu seul ne consomme aucun téléchargement, aucune restriction n'est nécessaire",
  'chat.attach.policy.footnote':
    'Après révocation, le destinataire ne peut plus récupérer la pièce jointe immédiatement ; les copies déjà téléchargées en local ne peuvent pas être récupérées.',

  // Barre des pièces jointes en attente d\'envoi : la page de discussion et le tiroir partagent
  // le même composant, les textes n\'appartiennent à aucun des deux
  'chat.attach.dropHint':
    'Glissez un fichier depuis la zone de fichiers, ou cliquez sur le trombone pour en choisir un dans « Mes fichiers » / en téléverser un depuis cet appareil ; {size} au maximum par fichier',
  'chat.attach.remove': "Retirer le fichier en attente d'envoi",
  'chat.attach.placeholder': 'Vous pouvez ajouter une légende (facultatif)',

  // Entrée du transfert de fichier (trombone → fenêtre « Envoyer un fichier ») : partagée entre
  // la page et le tiroir, les textes n\'appartiennent à aucun des deux
  'chat.attach.entry': 'Envoyer un fichier',
  'chat.attach.modalTitle': 'Envoyer un fichier',
  'chat.attach.fromDevice': 'Téléverser un fichier de cet appareil',
  'chat.attach.uploadHint':
    "Le fichier de cet appareil est d'abord téléversé dans vos fichiers, puis envoyé comme message de fichier",
  // Indication de taille : elle ne mentionne que la limite, sans blocage préalable
  // (la limite est configurable, la décision d\'acceptation fait autorité côté serveur)
  'chat.attach.sizeLimit': '{size} au maximum par fichier',
  'chat.attach.uploadProgress': 'Téléversement de {name} ({percent} %)',
  'chat.attach.uploadFailed':
    'Échec du téléversement : {name}, vous pouvez réessayer',
  'chat.attach.uploadNoNode':
    "Le téléversement est terminé, mais l'entrée de ce fichier est introuvable ; vérifiez dans « Mes fichiers » puis sélectionnez-le à nouveau",
  'chat.attach.pickerSearch': 'Rechercher un nom de fichier',
  'chat.attach.pickerEmpty': 'Aucun fichier correspondant',
  'chat.attach.pickerFailed':
    "La liste des fichiers n'a pas pu être chargée, veuillez réessayer plus tard",
  'chat.attach.pickerInvalid':
    'Ce fichier ne peut pas être sélectionné pour le moment, veuillez en choisir un autre',
  'chat.attach.pickerClose': 'Fermer',

  // Carte de pièce jointe (récupération sans demande pour le destinataire / consultation de la
  // consommation pour l\'expéditeur)
  'chat.attachCard.preview': 'Aperçu',
  'chat.attachCard.download': 'Télécharger',
  'chat.attachCard.save': 'Enregistrer dans mes fichiers',
  'chat.attachCard.saveSuccess': 'Enregistré dans vos fichiers',
  'chat.attachCard.revoke': "Révoquer l'autorisation",
  'chat.attachCard.revokeConfirmTitle':
    "Révoquer l'autorisation de récupération de cette pièce jointe ?",
  'chat.attachCard.revokeConfirmDesc':
    "Après révocation, l'interlocuteur ne peut plus récupérer la pièce jointe immédiatement, mais les copies déjà téléchargées en local ne peuvent pas être récupérées.",
  'chat.attachCard.revokeOk': 'Autorisation révoquée',
  'chat.attachCard.revoked': 'Révoquée',
  'chat.attachCard.expired': 'Expirée',
  'chat.attachCard.remaining': '{count} fois restantes',
  'chat.attachCard.unlimited': 'Illimité',
  'chat.attachCard.expireAt': "Valable jusqu'au {date}",
  'chat.attachCard.neverExpire': 'Valable sans limite de durée',
  'chat.attachCard.previewUnsupported':
    "L'aperçu en ligne n'est pas pris en charge pour ce type, veuillez télécharger le fichier pour le consulter",
  // Au niveau « aperçu uniquement », il n\'y a aucune entrée de téléchargement : on ne peut donc
  // pas conseiller de « télécharger pour consulter », mais seulement expliquer honnêtement que
  // cette voie est impossible
  'chat.attachCard.previewUnsupportedNoDownload':
    "Ce type ne peut pas être prévisualisé en ligne et l'expéditeur n'a pas autorisé le téléchargement ; veuillez contacter l'expéditeur pour qu'il vous le transmette autrement",

  // Tiroir de messagerie instantanée (deuxième entrée en dehors de /chat, textes indépendants
  // pour éviter toute dépendance mutuelle avec le titre de la page)
  'chat.drawer.title': 'Messages',
  'chat.drawer.backToList': 'Revenir à la liste des conversations',
  'chat.drawer.refresh': 'Actualiser la liste des conversations',
  'chat.drawer.close': 'Fermer le panneau des messages',
  'chat.drawer.emptyConversations': 'Aucune conversation pour le moment',
  'chat.drawer.openConversation': 'Ouvrir la conversation avec {name}',
  'chat.drawer.emptyMessages':
    'Aucun message pour le moment, glissez un fichier pour dire un mot',
  'chat.drawer.mineAvatar': 'Moi',
  'chat.drawer.fileFallback': '[Fichier] {content}',
  'chat.drawer.send': 'Envoyer',
  // Discussion de groupe : nombre de membres et alertes (les trois interrupteurs du panneau)
  'chat.group.memberCount': '{count} membres',
  'chat.composer.mentionAll': 'Tout le monde',
  'chat.group.notify.title': 'Alertes de messages',
  'chat.group.notify.mute': 'Mettre ce groupe en sourdine',
  'chat.group.notify.mention': 'Alerte quand on me mentionne',
  'chat.group.notify.mentionAll':
    'Alerte quand le propriétaire mentionne tout le monde',
  'chat.group.notify.muteHint':
    'Les messages de ce groupe ne sonnent plus ; les deux interrupteurs ci-dessous décident si vous êtes quand même alerté.',
  'chat.group.notify.mentionHint':
    'Les messages de ce groupe sont signalés normalement ; les deux interrupteurs ci-dessous prennent effet une fois la sourdine activée.',
} as const;
