/** Textes de la page de téléversement par segments et de la fenêtre de téléversement. */
export default {
  'upload.title': 'Téléverser des fichiers',
  'upload.titleWithFolder': 'Téléverser des fichiers (dossier n° {folderId})',
  'upload.dropText': 'Cliquez ou glissez-déposez des fichiers ici',
  'upload.dropHint':
    "Sélection multiple prise en charge ; les gros fichiers sont automatiquement découpés en segments (4 MiB par défaut) et leur empreinte calculée ; en cas d'envoi instantané, aucun transfert n'est nécessaire",
  'upload.instant': 'Envoi instantané',
  'upload.verifying': 'Vérification',
  'upload.chunkProgress': ' · {received}/{total} segments',
  'upload.chunkTooltip': 'Segment {index}',
  'upload.retried': 'Réessayé automatiquement {count} fois',
  'upload.empty': 'Aucune tâche de téléversement',
  'upload.summary':
    'En cours {uploading} · Terminés {finished} · Total {total}',

  // État de la tâche
  'upload.status.pending': "En file d'attente",
  'upload.status.hashing': "Calcul de l'empreinte",
  'upload.status.prechecking': "Précontrôle d'envoi instantané",
  'upload.status.querying': 'Recherche des segments',
  'upload.status.uploading': 'Téléversement',
  'upload.status.paused': 'En pause',
  'upload.status.merging': 'Fusion',
  'upload.status.success': 'Terminé',
  'upload.status.error': 'Échec',
  'upload.status.canceled': 'Annulé',

  // Messages d'erreur (traduits dans la langue courante avant d'être levés par la couche service, voir services/upload)
  'upload.error.generic': 'Échec du téléversement',
  'upload.error.network':
    'Anomalie réseau. Vérifiez votre connexion puis réessayez',
  'upload.error.timeout': 'Délai de téléversement dépassé',
  'upload.error.badContract':
    'La structure de réponse du serveur ne respecte pas le contrat unifié',
  'upload.error.instantWithoutFileId':
    'Envoi instantané déclenché mais aucun fileId renvoyé',
  'upload.error.missWithoutUploadId':
    'Envoi instantané non déclenché mais aucun uploadId renvoyé',
  'upload.error.partHttp': 'Échec du téléversement du segment (HTTP {status})',
  'upload.error.hashWorkerFailed': "Échec de l'exécution du Worker de hachage",
  'upload.error.hashFailed': 'Échec du calcul du hachage',

  // Actions
  'upload.action.pause': 'Mettre en pause',
  'upload.action.resume': 'Reprendre',
  'upload.action.remove': 'Retirer',
  'upload.action.pauseAll': 'Tout mettre en pause',
  'upload.action.resumeAll': 'Tout reprendre',
  'upload.action.clearFinished': 'Effacer les tâches terminées',
  // Reprise
  'upload.resumable.title': 'Un téléversement inachevé a été détecté',
  'upload.resumable.note':
    "La progression ci-dessous provient du cache local et n'est donnée qu'à titre indicatif ; la position réelle de reprise se fonde sur la liste des segments du serveur.",
  'upload.resumable.record':
    '{name} ({size}, {received}/{total} segments terminés)',
  'upload.resumable.ignore': 'Ignorer',
  'upload.resumable.select': 'Sélectionner le fichier pour reprendre',
  'upload.resumable.hint':
    'Sélectionnez le même fichier portant le même nom que la fois précédente (un fichier de même nom au contenu modifié sera détecté et renvoyé intégralement)',

  // Liste des tâches terminées
  'upload.column.method': 'Méthode',
  'upload.column.chunked': 'Téléversement par segments',

  // Mode de téléversement (forme du corps de requête par segment) — la carte de la page de démonstration et le composant de téléversement partagent la même terminologie
  'upload.mode.title': 'Mode de téléversement',
  'upload.mode.subtitle':
    'Deux formes de corps de requête par segment, avec des paramètres conservés séparément',
  'upload.mode.active': 'Actuellement utilisé',
  'upload.mode.use': 'Utiliser ce mode',
  'upload.mode.fact.request': 'Corps de requête',
  'upload.mode.fact.scene': "Cas d'usage",
  'upload.mode.unsupportedTag': 'Non pris en charge par le backend',
  'upload.mode.switchHint':
    "Le changement n'affecte que les tâches ajoutées ensuite : les tâches en cours conservent le mode utilisé à leur démarrage, si bien qu'un même téléversement ne mélange jamais les deux corps de requête ; les nouveaux paramètres prennent eux aussi effet à partir de la tâche suivante.",
  'upload.mode.multipart.title': 'Segment de formulaire',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    "Chaque segment est envoyé sous forme de `FormData`, avec l'indice et l'empreinte du segment transmis dans les champs du formulaire. C'est le mode le plus compatible et l'option par défaut du backend actuel.",
  'upload.mode.multipart.request':
    'API de segment `PUT`, corps de requête `FormData` (`chunk` + `index` + `hash`)',
  'upload.mode.multipart.scene':
    'Le backend reçoit les segments via Spring `@RequestPart` / `MultipartFile` (option par défaut du contrat)',
  'upload.mode.octetStream.title': 'Flux binaire',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    "Le segment est transmis directement en flux d'octets brut comme corps de requête, l'indice étant déterminé par l'URL : une couche d'encapsulation de formulaire et une copie mémoire en moins.",
  'upload.mode.octetStream.request':
    "API de segment `PUT`, corps de requête en flux d'octets brut (`Content-Type: application/octet-stream`, sans champ `hash`)",
  'upload.mode.octetStream.scene':
    'Transfert direct vers le stockage objet, ou scénarios où la passerelle transmet le flux brut sans analyser de formulaire',
  'upload.mode.octetStream.unsupported':
    "L'API de segment d'at-transfer ne déclare actuellement que `multipart/form-data` ; choisir ce mode provoquera une erreur HTTP 415 lors de l'envoi des segments. Le backend doit d'abord accepter la réception de flux brut (le front-end, lui, est déjà prêt).",
  // Page de démonstration (/upload). Les accents graves du texte sont rendus en style de code en ligne par la page.
  'upload.demo.pageTitle': 'Téléversement par segments',
  'upload.demo.pageSubtitle':
    'Envoi instantané · reprise · segments simultanés',
  'upload.demo.pipeline.title': 'Chaîne de téléversement',
  'upload.demo.pipeline.subtitle':
    'Empreinte → envoi instantané → envoi complémentaire → fusion',
  'upload.demo.pipeline.desc':
    "Pour les gros fichiers, l'empreinte est d'abord calculée en local ; le serveur s'en sert pour déterminer si l'envoi instantané est possible. En cas d'échec, seuls les segments manquants sont envoyés ; à tout moment, il suffit d'actualiser la page et de resélectionner le même fichier pour reprendre là où le serveur s'est arrêté.",
  'upload.demo.step.hash.title': 'Calculer la somme de contrôle',
  'upload.demo.step.hash.desc':
    'SHA-256 incrémental dans un Worker, sans bloquer le thread principal',
  'upload.demo.step.precheck.title': "Précontrôle d'envoi instantané",
  'upload.demo.step.precheck.desc':
    "Un simple succès sur l'empreinte suffit, 0 octet transféré",
  'upload.demo.step.query.title': 'Rechercher les segments reçus',
  'upload.demo.step.query.desc': 'Se fonde sur la liste du serveur',
  'upload.demo.step.upload.title':
    'Envoyer les segments manquants en parallèle',
  'upload.demo.step.upload.desc':
    "3 en parallèle par défaut, nouvelle tentative avec repli en cas d'échec",
  'upload.demo.step.merge.title': 'Fusion et vérification',
  'upload.demo.step.merge.desc':
    "Le serveur recalcule l'empreinte du fichier complet avant la fusion",
  'upload.demo.chunkTitle': 'Démonstration du téléversement par segments',
  'upload.demo.finished.title': 'Fichiers terminés',
  'upload.demo.finished.subtitle': 'Conserve au plus les {count} derniers',
  'upload.demo.usage.title': "Modes d'intégration",
  'upload.demo.usage.subtitle':
    'Deux usages, composant et Hook, partageant la même file',
  'upload.demo.usage.desc':
    "Le composant intègre sa propre file et l'affichage de progression et s'utilise tel quel dans une page ; pour organiser soi-même la mise en page dans une page métier, utilisez plutôt le Hook `useChunkUpload()` pour récupérer l'état et les actions et dessiner l'interface. Les deux ne se fient qu'à l'`id` : un `id` identique désigne la même file, ils peuvent donc coexister sur une même page.",
  'upload.demo.usage.tab.component': 'Usage du composant',
  'upload.demo.usage.tab.hook': 'Usage du Hook',
  'upload.demo.usage.component.point1':
    "L'`id` détermine l'identité de la file : plusieurs composants de même id partagent une seule file ; changer de page ou remonter le composant n'interrompt pas le transfert.",
  'upload.demo.usage.component.point2':
    "`chunkSize` et `concurrency` sont ramenés aux bornes du contrat lors de la mise en file (≤ 8 MiB, 1 à 5 en parallèle) ; une valeur hors limites n'enverra jamais de segment illégal.",
  'upload.demo.usage.component.point3':
    "`partPayloadMode` s'applique par tâche : le changer en cours de téléversement n'affecte que les tâches ajoutées ensuite.",
  'upload.demo.usage.hook.point1':
    "`tasks` et `resumable` sont des instantanés issus d'un abonnement : la progression ne repose pas sur un sondage et les mises à jour fréquentes ne sont pas écrites dans le state.",
  'upload.demo.usage.hook.point2':
    "`start()` démarre dès l'ajout des fichiers et renvoie l'id de ce lot de tâches ; pause / reprise / nouvelle tentative / annulation disposent chacune de leur action.",
  'upload.demo.usage.hook.point3':
    "Le Hook ne fournit que l'état et les actions, sans dessiner l'interface : liste, barres de progression et boutons sont entièrement à la charge de la page métier.",
  'upload.demo.tryRun.title': 'Comment tester',
  'upload.demo.tryRun.localMock':
    "Cette page intègre un mock local (`src/pages/upload/_mock.ts` ; umi ne charge que les `_mock.ts` situés dans les répertoires de pages) : lancée avec `npm run start` (qui active automatiquement le mock), la chaîne de téléversement fonctionne hors ligne et un second envoi du même fichier déclenche l'envoi instantané.",
  'upload.demo.tryRun.dev':
    "Un lancement avec `npm run dev` désactive le mock et redirige `/api` vers `localhost:8080` ; l'API backend at-transfer doit alors être prête.",
  'upload.demo.tryRun.auth':
    "Attention : comme les autres pages métier, cette page est protégée par un garde de connexion (les utilisateurs non connectés sont redirigés vers `/user/login`) ; l'API de connexion n'a pas de mock et nécessite que le backend at-auth soit prêt. Le mock ne couvre donc que le segment « chaîne de téléversement ».",
} as const;
