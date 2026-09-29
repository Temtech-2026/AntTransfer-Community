/**
 * Textes des composants communs (barre supérieure / barre latérale / recherche globale / cloche de notifications / changement d'organisation / zone de glisser-déposer / sélection d'étiquettes).
 *
 * <p>Ces composants sont montés sur toute la coque et rendus par chaque page ; un seul texte codé en dur
 * ferait fuiter le chinois dans l'interface française, d'où leur regroupement dans ce domaine.</p>
 */
export default {
  'component.langSwitch': 'Changement de langue',

  // Sélection d'étiquettes
  'component.tagSelect.expand': 'Développer',
  'component.tagSelect.collapse': 'Réduire',
  'component.tagSelect.all': 'Tous',

  // Entrées du bas de la barre latérale
  'component.siderFooter.messages': 'Messages',
  'component.siderFooter.transfer': 'Transferts',
  'component.siderFooter.openMessages': 'Ouvrir le panneau des messages',
  'component.siderFooter.openTransfer': 'Ouvrir le centre de transferts',

  // Recherche globale de la barre supérieure
  'component.globalSearch.placeholder':
    'Rechercher un nom de fichier / une étiquette ; Entrée pour localiser le fichier',
  'component.globalSearch.ariaLabel': 'Recherche globale',
  'component.globalSearch.scopeAria': 'Description du périmètre de recherche',
  'component.globalSearch.scopeTitle':
    "Périmètre : noms de fichiers et étiquettes (ouvre l'espace de travail des fichiers).",
  'component.globalSearch.scopeEe':
    "La recherche plein texte dans le contenu des fichiers nécessite extraction et indexation ; cette capacité relève de l'édition EE.",

  // Entrée documentation de la barre supérieure
  'component.docLink.title': 'Documentation',

  // Entrée versions précédentes de la barre supérieure
  'component.version.history': 'Versions précédentes',

  // Contenu de la liste d'articles (composant modèle)
  'component.articleList.publishedAt': 'Publié le',

  // Menu déroulant de l'avatar et informations personnelles
  'component.avatar.profile': 'Informations personnelles',
  'component.avatar.changePassword': 'Modifier le mot de passe',
  'component.avatar.logout': 'Se déconnecter',
  'component.avatar.account': 'Compte',
  'component.avatar.nickname': 'Pseudo',
  'component.avatar.roles': 'Rôles',

  // Remplacement autonome de l'avatar dans la fenêtre d'informations personnelles (prise d'effet immédiate, sans enregistrement de formulaire)
  // Les messages d'échec de précontrôle réutilisent system.user.avatar.tooLarge / typeInvalid :
  // checkAvatarFile est un précontrôle partagé nommé d'après le domaine d'administration système ;
  // aucune clé distincte n'est créée pour éviter de maintenir deux fois la même phrase
  'component.avatar.avatar.upload': 'Téléverser un avatar',
  'component.avatar.avatar.hint':
    "Formats pris en charge : PNG / JPEG / GIF / WebP, jusqu'à {max}",
  'component.avatar.avatar.updated': 'Avatar mis à jour',

  // Fenêtre de changement de mot de passe autonome (révocation globale après succès, reconnexion obligatoire)
  'component.avatar.changePassword.title': 'Modifier le mot de passe',
  'component.avatar.changePassword.alert.title':
    'Une reconnexion est nécessaire après la modification',
  'component.avatar.changePassword.alert.desc':
    'Pour protéger votre compte, la modification du mot de passe invalide immédiatement les sessions de tous les appareils. Reconnectez-vous avec le nouveau mot de passe.',
  'component.avatar.changePassword.old': 'Mot de passe actuel',
  'component.avatar.changePassword.oldPlaceholder':
    'Saisissez votre mot de passe actuel',
  'component.avatar.changePassword.oldRequired':
    'Veuillez saisir votre mot de passe actuel',
  'component.avatar.changePassword.new': 'Nouveau mot de passe',
  'component.avatar.changePassword.newPlaceholder':
    'Saisissez le nouveau mot de passe',
  'component.avatar.changePassword.newRequired':
    'Veuillez saisir le nouveau mot de passe',
  'component.avatar.changePassword.newLength':
    'Le mot de passe doit comporter de 8 à 64 caractères',
  'component.avatar.changePassword.newPattern':
    'Le mot de passe doit contenir à la fois des lettres et des chiffres, sans espace',
  'component.avatar.changePassword.policyHint':
    'De 8 à 64 caractères, avec lettres et chiffres',
  'component.avatar.changePassword.confirm':
    'Confirmer le nouveau mot de passe',
  'component.avatar.changePassword.confirmPlaceholder':
    'Saisissez à nouveau le nouveau mot de passe',
  'component.avatar.changePassword.confirmRequired':
    'Veuillez saisir à nouveau le nouveau mot de passe',
  'component.avatar.changePassword.confirmMismatch':
    'Les deux mots de passe ne correspondent pas',
  'component.avatar.changePassword.submit': 'Confirmer la modification',
  'component.avatar.changePassword.done':
    'Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe',
  // Cloche de notifications
  'component.notify.title': 'Notifications',
  'component.notify.count.inbox': 'Notifications {count}',
  'component.notify.count.todo': 'À faire {count}',
  'component.notify.count.chat': 'Messages privés {count}',
  'component.notify.markAllRead': 'Tout marquer comme lu',
  'component.notify.markedAllRead': 'Tout est marqué comme lu',
  'component.notify.status.idle': 'Canal temps réel non démarré',
  'component.notify.status.connecting': 'Connexion…',
  'component.notify.status.open': 'Notifications en temps réel connectées',
  'component.notify.status.reconnecting': 'Connexion interrompue, reconnexion…',
  'component.notify.status.closed': 'Canal temps réel déconnecté',

  // Sélecteur d'organisation / d'équipe
  'component.org.defaultName': 'Organisation par défaut',
  'component.org.current': 'Déploiement actuel',
  'component.org.create': 'Créer une organisation / équipe',
  'component.org.switch': 'Basculer vers une autre organisation',
  'component.org.eeHint':
    "L'isolation totale des données entre organisations (multi-organisations, vente de licences) relève de l'édition EE ; l'édition CE est un déploiement auto-hébergé mono-organisation.",
  'component.org.tooltip': 'Organisation actuelle : {name}',

  // Zone de glisser-déposer / sélection de fichiers
  'component.dropZone.title':
    'Glissez-déposez des fichiers ici ou cliquez pour parcourir',

  // Composant de téléversement par segments
  'component.chunkUpload.title': 'Téléversement de fichiers',
  'component.chunkUpload.busy': '{count} tâches en cours',
  'component.chunkUpload.resumableCount':
    '{count} téléversements inachevés détectés',
  'component.chunkUpload.resumableNote':
    'Pour éviter tout transfert en double, sélectionnez à nouveau le même fichier ; le système ignorera les segments déjà reçus par le serveur et poursuivra le téléversement.',
  'component.chunkUpload.resumableSelect':
    'Resélectionner le fichier pour continuer',
  'component.chunkUpload.instantDone': 'Envoi instantané terminé',
  'component.chunkUpload.instantSuccess': 'Envoi instantané réussi',
  'component.chunkUpload.progress.hashing':
    'Calcul de la somme de contrôle du fichier…',
  'component.chunkUpload.progress.prechecking':
    "Vérification de l'éligibilité à l'envoi instantané…",
  'component.chunkUpload.progress.querying':
    'Récupération des segments déjà téléversés…',
  'component.chunkUpload.progress.merging': 'Fusion des segments…',
  'component.chunkUpload.progress.paused':
    'En pause ({received}/{total} segments terminés)',
  'component.chunkUpload.progress.failed': 'Échec du téléversement',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} segments · {speed}',
  'component.chunkUpload.progress.retried': ' · {count} tentatives',
  'component.chunkUpload.progress.chunks': '{count} segments',
  'component.chunkUpload.retryTooltip':
    "Nouvelle tentative automatique avec repli exponentiel en cas d'instabilité réseau",
  'component.chunkUpload.retryTag': 'Tentatives {count}',
  'component.chunkUpload.draggerText':
    'Cliquez ou glissez-déposez des fichiers ici pour les téléverser',
  'component.chunkUpload.draggerHint':
    "Prise en charge du téléversement par segments des gros fichiers, de l'envoi instantané et de la reprise ; un fichier en échec est retenté automatiquement {count} fois",
  'component.chunkUpload.chunkSize': 'Taille des segments',
  'component.chunkUpload.concurrency': 'Parallélisme',
  'component.chunkUpload.tuningNote':
    "Les modifications s'appliquent aux segments suivants",
  'component.chunkUpload.overallProgress': 'Progression globale',
  'component.chunkUpload.overallSummary':
    '{finished}/{total} fichiers · {uploaded} / {totalSize}',
  // Bloc de code (affichage d'exemples de code dans la documentation)
  'component.codeBlock.copy': 'Copier',
  'component.codeBlock.copied': 'Copié',
  'component.codeBlock.copyFailed': 'Échec de la copie',

  // Fenêtre flottante de suivi des transferts
  'component.transfer.title': 'Centre de transferts',
  'component.transfer.expand': 'Développer le centre de transferts',
  'component.transfer.collapse': 'Réduire le centre de transferts',
  'component.transfer.capsule': 'Transferts {count}',
  'component.transfer.summary': '{active} en cours · {success} terminés',
  'component.transfer.summaryFailed': ' · {count} en échec',
  'component.transfer.pauseAll': 'Tout mettre en pause',
  'component.transfer.resumeAll': 'Tout reprendre / réessayer les échecs',
  'component.transfer.clearFinished':
    'Effacer les terminés / annulés / échoués',
  'component.transfer.fastMode': 'Mode turbo',
  'component.transfer.fastModeHint':
    "Porte le nombre de segments simultanés au plafond du contrat, soit 5 ; s'applique aussi aux tâches en cours. Le parallélisme choisi sur la page de téléversement est alors remplacé par ce réglage.",
  'component.transfer.empty': 'Aucune tâche de transfert',
  'component.transfer.chartAria': 'Courbe de vitesse de transfert',
  'component.transfer.pause': 'Mettre en pause',
  'component.transfer.resumeRetry': 'Reprendre / réessayer',
  'component.transfer.pauseNamed': 'Mettre en pause {name}',
  'component.transfer.resumeNamed': 'Reprendre {name}',
  'component.transfer.status.active': 'En transfert',
  'component.transfer.status.paused': 'En pause',
  'component.transfer.status.error': 'Échec',
  'component.transfer.status.success': 'Terminé',
  'component.transfer.status.canceled': 'Annulé',
  // Son des nouveaux messages (dans le profil ; presets et interrupteurs partagent le préfixe)
  'component.avatar.notifySound.title': 'Son des nouveaux messages',
  'component.avatar.notifySound.enabled':
    'Jouer un son à la réception de messages',
  'component.avatar.notifySound.presetLabel': 'Son',
  'component.avatar.notifySound.preset.default': 'Par défaut',
  'component.avatar.notifySound.preset.chime': 'Carillon',
  'component.avatar.notifySound.preset.bubble': 'Bulle',
  'component.avatar.notifySound.preset.custom': 'Personnalisé',
  'component.avatar.notifySound.upload': 'Téléverser un audio',
  'component.avatar.notifySound.replace': "Remplacer l'audio",
  'component.avatar.notifySound.clear': 'Supprimer',
  'component.avatar.notifySound.preview': 'Écouter',
  'component.avatar.notifySound.uploaded':
    'Téléversé ; le son est passé en personnalisé',
  'component.avatar.notifySound.cleared': 'Son personnalisé supprimé',
  'component.avatar.notifySound.loadFailed':
    'Échec du chargement des réglages de son',
  'component.avatar.notifySound.typeInvalid':
    'Seuls les formats MP3 / WAV / OGG sont pris en charge',
  'component.avatar.notifySound.tooLarge': "L'audio ne doit pas dépasser {max}",
  'component.avatar.notifySound.previewBlocked':
    "Le navigateur a bloqué la lecture automatique. Cliquez n'importe où sur la page puis réessayez.",
  'component.avatar.notifySound.customEmpty':
    'Aucun audio personnalisé téléversé',
  'component.avatar.notifySound.customMeta':
    'Audio actuel : {name} ({size}, {duration})',
  'component.avatar.notifySound.hint':
    "Formats MP3 / WAV / OGG, jusqu'à {maxSize} et {maxDuration} de durée",
} as const;
