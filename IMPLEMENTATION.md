# Cahier d'implémentation — Système de gestion des opérations

**Destinataire : Claude Code.** Ce document est la spécification de référence. Suis-la ; si une décision manque, applique la règle par défaut indiquée et signale-la plutôt que d'inventer en silence.

---

## 1. Contexte métier

L'entreprise est un bureau de services en Haïti avec trois activités :

1. **Transferts** — la diaspora envoie via Zelle, CashApp, ou par dépôt/virement sur le compte de l'entreprise. Le bénéficiaire se présente au bureau et récupère l'argent en dollars ou en gourdes.
2. **Services légaux** — extrait d'archive, passeport (phase 2).
3. **Vente de produits** — vin, rhum Barbancourt, etc. (phase 3).

Deux caissiers servent les clients. Le flux actuel : le client envoie une capture d'écran de la transaction par WhatsApp, la caissière vérifie sur le compte Zelle/CashApp, demande au client la devise voulue, prend sa pièce d'identité, remplit un reçu manuscrit que le client signe.

Tout est actuellement dans un fichier Excel partagé.

**Objectif de la phase 1 : remplacer entièrement le fichier Excel pour l'activité transferts, et fiabiliser la caisse.**

---

## 2. Contraintes d'environnement (déterminantes pour l'architecture)

- **L'entreprise a une connexion Internet fiable** (confirmé par le client — pas de contrainte de fonctionnement hors ligne pour la phase 1).
- **L'électricité coupe côté bureau**, mais l'hébergement (app + base) est dans le cloud, donc non affecté directement ; seuls les postes clients perdent l'accès pendant la coupure.
- Matériel disponible : ordinateurs de bureau et téléphones Android d'entrée de gamme.
- Utilisateurs peu à l'aise avec l'informatique. Interface en **français**, dense en information mais avec très peu de champs à saisir.
- Deux devises en circulation permanente : **USD** et **HTG (gourde)**.

---

## 3. Architecture retenue

**Application web hébergée sur Vercel, base de données PostgreSQL managée sur Railway, accessible depuis les postes du bureau via Internet.**

```
[Vercel]              [Railway]                    [Postes bureau]
  Next.js (app + API)   PostgreSQL (managé)           PC caisse 1
  déploiement continu   Sauvegardes                   PC caisse 2
  depuis GitHub          (pg_dump / snapshots)         Téléphone Android (direction)
       │                      ▲
       └──────── Internet ────┘
```

**Pourquoi ce choix plutôt qu'un mini-PC local :** le client a confirmé une connexion Internet fiable, ce qui lève la contrainte de fonctionnement 100 % hors-ligne qui motivait un hébergement local. Un hébergement cloud managé simplifie l'exploitation (pas de matériel serveur à maintenir physiquement, pas d'onduleur à gérer, sauvegardes gérées par la plateforme). Vercel héberge l'application (déploiement continu depuis `main` sur GitHub), Railway héberge uniquement PostgreSQL. **Risque résiduel accepté :** en cas de coupure Internet côté bureau, la caisse est bloquée le temps de la coupure — accepté par le client compte tenu de la fiabilité de sa connexion. **On garde une seule base de données, une seule vérité.** Si l'entreprise ouvre une deuxième succursale, on réévaluera à ce moment-là.

Les pièces jointes (`Attachment.filePath`, §5) ne doivent **pas** être stockées sur le disque éphémère de l'instance applicative Railway — elles sont uploadées vers **Cloudinary**, et `Attachment` stocke l'identifiant public (`publicId`) et l'URL sécurisée retournée, pas un chemin disque. Les photos de pièces d'identité utilisent un accès signé/privé (pas de délivrance via une URL publique permanente), conformément à la contrainte du §10 (route authentifiée qui vérifie le rôle).

### Stack

| Couche | Choix |
|---|---|
| Langage | TypeScript (strict) |
| Framework | Next.js (App Router), Server Actions pour les mutations |
| Base de données | PostgreSQL 16, managé sur **Railway** |
| ORM | Prisma |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Sessions serveur (cookie httpOnly), mots de passe hachés avec argon2 |
| Stockage fichiers | Cloudinary (captures d'écran, photos de pièces) |
| Déploiement | Vercel (app, déploiement continu depuis GitHub) + Railway (PostgreSQL managé) |
| Tests | Vitest (logique métier), Playwright (parcours critiques) |

**Contrainte : aucune dépendance à un service externe non maîtrisé au moment de la transaction.** Pas de CDN bloquant, pas d'appel API tiers dans le chemin critique de calcul/paiement.

---

## 4. Règles métier — le cœur du système

### 4.1 Grille tarifaire actuelle

| Canal d'entrée | Devise remise au client | Frais | Taux appliqué |
|---|---|---|---|
| Zelle | USD | 10 % | — |
| Zelle | HTG | 10 % | 133 |
| CashApp | USD | 15 % | — |
| CashApp | HTG | 15 % | 133 |
| Dépôt / virement USD | USD | 10 % | — |
| Dépôt / virement USD | HTG | 0 % | 130 |
| Virement HTG | HTG | 2 % | — |
| Virement HTG | USD | **interdit** | — |

### 4.2 Implémentation obligatoire

Ces valeurs **ne doivent jamais être écrites en dur dans le code**. Elles vivent dans une table `pricing_rule` versionnée, modifiable par l'administrateur depuis l'interface.

```
PricingRule
  channel            ZELLE | CASHAPP | DEPOSIT_USD | TRANSFER_HTG
  payoutCurrency     USD | HTG
  allowed            boolean          // TRANSFER_HTG + USD => false
  feePercent         Decimal(5,2)     // 10.00, 15.00, 2.00, 0.00
  exchangeRate       Decimal(10,4)?   // 133.0000, 130.0000, null si USD
  feeBeforeConversion boolean         // voir §4.3
  effectiveFrom      DateTime
  effectiveTo        DateTime?        // null = règle active
  createdById        String
```

`ReferenceRate` suit le même principe de versionnement (jamais d'update, clôture + insertion) : c'est le taux de marché saisi par l'admin (§7.8), indépendant du taux appliqué au client, utilisé uniquement pour calculer la marge de change dans les rapports.

Une modification **ne met jamais à jour une ligne existante** : elle clôt la règle courante (`effectiveTo = now`) et en insère une nouvelle. L'historique des taux est un actif comptable.

**Instabilité monétaire (confirmé par le client, 2026-07-28) :** le taux de change peut varier fréquemment. C'est exactement ce que le versionnement de `PricingRule` est conçu pour absorber — l'admin change le taux depuis l'écran de grille tarifaire (§7.7) à tout moment, sans déploiement de code, et chaque transaction garde le taux réellement appliqué au moment où elle a été créée.

### 4.3 Calcul

```
montantRecu (USD ou HTG selon le canal)
  ↓
si feeBeforeConversion:
    net = montantRecu × (1 − feePercent/100)
    montantARemettre = (payoutCurrency == HTG) ? net × exchangeRate : net
sinon:
    brut = (payoutCurrency == HTG) ? montantRecu × exchangeRate : montantRecu
    montantARemettre = brut × (1 − feePercent/100)
```

**Confirmé par le client (2026-07-28) :** pour Zelle et CashApp en gourdes, les frais (10 % / 15 %) sont retirés **avant** la conversion — `feeBeforeConversion = true` sur les 8 lignes de la grille. C'est la valeur déjà utilisée dans le seed, aucun changement de code nécessaire.

### 4.4 Représentation de l'argent

- **Aucun `float`, jamais.** Montants stockés en entiers : centimes pour l'USD, centimes de gourde pour le HTG. Type Prisma `BigInt` ou `Decimal(18,2)` — choisis `Decimal` avec `Prisma.Decimal` côté application, jamais `number`.
- Arrondi du montant remis en gourdes : à la gourde entière, arrondi **au plus proche**, paramétrable (`roundingUnit` en configuration, défaut 1 HTG). Beaucoup de bureaux arrondissent à 5 HTG — pose la question.
- Toute transaction stocke **le taux et le pourcentage réellement appliqués**, jamais une référence à la règle courante. Un rapport de l'an dernier doit rester juste après un changement de taux.

---

## 5. Modèle de données (phase 1)

```
User
  id, fullName, username (unique), passwordHash
  role: CASHIER | SUPERVISOR | ADMIN
  active: boolean
  createdAt

Client                       // le bénéficiaire qui se présente au guichet
  id, fullName, phone?
  idType: NIF | NIU | PASSPORT | PERMIS | AUTRE   // NIU remplace CIN, confirmé 2026-07-28
  idNumber
  createdAt, createdById
  // index unique (idType, idNumber)

Transaction
  id
  receiptNo           // TRF-2026-000123, séquentiel, généré en base
  channel             ZELLE | CASHAPP | DEPOSIT_USD | TRANSFER_HTG
  externalRef         // généré par le système : <PREFIXE>-<séquence>, ex. ZL-000123 (voir §7.3)
  senderName          // l'expéditeur à l'étranger
  clientId            // bénéficiaire visé (désigné par l'expéditeur)
  collectedById?       // procuration : qui a réellement retiré l'argent, si différent (§7.4)
  amountReceived      Decimal  // dans la devise d'entrée
  receivedCurrency    USD | HTG
  payoutCurrency      USD | HTG
  feePercentApplied   Decimal
  exchangeRateApplied Decimal?
  feeAmount           Decimal
  netPayout           Decimal  // ce que le client reçoit
  status              RECEIVED | VERIFIED | PAID | CANCELLED
  createdById, verifiedById?, paidById?
  createdAt, verifiedAt?, paidAt?
  cancelledById?, cancelledAt?, cancelReason?
  cashSessionId?      // session de caisse ayant payé
  // CONTRAINTE UNIQUE (channel, externalRef) — garantie technique (la séquence
  // ne peut pas collisionner), plus un rempart contre un vrai doublon métier
  // depuis que la référence n'est plus saisie à la main — voir §7.3
  // index (status, createdAt), (clientId)

Attachment
  id, transactionId
  kind: PAYMENT_SCREENSHOT | ID_DOCUMENT | OTHER
  publicId            // identifiant Cloudinary, pas de fichier en base
  secureUrl
  mimeType, sizeBytes
  uploadedById, createdAt

CashSession                  // caisse COMMUNE, pas une par caissier (confirmé 2026-07-28)
  id, openedById              // toujours un ADMIN
  openedAt, closedAt?
  openingUsd, openingHtg
  expectedUsd, expectedHtg   // calculés à la clôture
  countedUsd?, countedHtg?
  varianceUsd?, varianceHtg?
  varianceNote?
  status: OPEN | CLOSED

CashMovement
  id, cashSessionId
  direction: IN | OUT
  currency: USD | HTG
  amount: Decimal
  reason: TRANSFER_PAYOUT | TRANSFER_FEE_IN | DEPOSIT_IN | EXPENSE | ADJUSTMENT | OPENING | CASH_TOPUP | OTHER
  transactionId?
  note?
  createdById, createdAt      // l'agent qui a réellement remis l'argent, distinct de openedById

AuditLog                     // append-only, jamais de UPDATE ni DELETE
  id, userId, action, entityType, entityId
  beforeJson?, afterJson?
  ipAddress?, createdAt

MobileMoneyOperation          // cahier BRH agent MonCash/NatCash — distinct de Transaction (§7.9)
  id
  provider: MONCASH | NATCASH
  operationType: RETRAIT | DEPOT | TRANSFERT
  clientNumber                // numéro du client au guichet
  destinataireNumber?         // uniquement pour TRANSFERT
  amount: Decimal             // HTG uniquement
  createdById, createdAt      // append-only, jamais de UPDATE ni DELETE
```

### Règles d'intégrité à imposer en base, pas seulement en code

- `UNIQUE (channel, externalRef)` sur `Transaction`.
- `receiptNo` généré par une séquence PostgreSQL, jamais côté application.
- Aucune suppression de transaction. Une erreur se corrige par `CANCELLED` + motif obligatoire, réservé au rôle SUPERVISOR ou ADMIN.
- `AuditLog` : révoquer les droits UPDATE/DELETE au rôle applicatif PostgreSQL.

---

## 6. Rôles et permissions

| Action | CASHIER | SUPERVISOR | ADMIN |
|---|---|---|---|
| Créer une transaction | ✓ | ✓ | ✓ |
| Marquer vérifiée / payée | ✓ | ✓ | ✓ |
| Annuler une transaction | ✗ | ✓ | ✓ |
| Payer (puise dans la caisse commune) | ✓ | ✓ | ✓ |
| Ouvrir / clôturer la caisse commune | ✗ | ✗ | ✓ |
| Ajouter un apport de liquidités | ✗ | ✗ | ✓ |
| Consulter l'état de la caisse commune | ✓ | ✓ | ✓ |
| Modifier taux et frais | ✗ | ✗ | ✓ |
| Rapports globaux | ✗ | ✓ | ✓ |
| Gérer les utilisateurs | ✗ | ✗ | ✓ |
| Consulter le journal d'audit | ✗ | ✗ | ✓ |

Les permissions sont vérifiées **côté serveur dans chaque Server Action**. Masquer un bouton dans l'interface n'est pas un contrôle d'accès.

---

## 7. Écrans (phase 1)

### 7.1 Connexion
Nom d'utilisateur + mot de passe. Rien d'autre. Session de 12 heures.

### 7.2 Tableau de bord caissier
- Bandeau permanent : **taux du jour affiché en grand** (133 / 130), état de ma caisse (USD et HTG), nombre de transactions du jour.
- Bouton principal, très visible : **Nouvelle transaction**.
- Liste des transactions du jour avec leur statut, filtrable.

### 7.3 Nouvelle transaction — écran unique, trois blocs

**Bloc 1 — Origine**
- Canal (4 gros boutons : Zelle / CashApp / Dépôt USD / Virement HTG)
- **Référence de la transaction : générée automatiquement par le système, pas de saisie manuelle** (changement confirmé 2026-07-28). Le numéro de confirmation réel Zelle/CashApp n'apparaît pas toujours dans la capture d'écran (surtout CashApp, et souvent absent des captures Zelle selon comment le client l'a prise) — demander à la caissière de le recopier n'était pas fiable. Format `<PRÉFIXE>-<séquence>` par canal : `ZL-`, `CA-`, `DU-`, `VH-`, via une séquence Postgres partagée garantissant l'unicité. **Conséquence assumée** : ceci protège contre un doublon technique mais ne détecte plus si le même virement réel est saisi deux fois — ce garde-fou repose désormais uniquement sur l'étape humaine « Vérifié » (§7.4), où la caissière confirme avoir vu l'argent sur le compte.
- Nom de l'expéditeur
- Montant reçu
- Zone de dépôt pour la capture d'écran (glisser-déposer ou depuis l'appareil photo sur mobile)

**Bloc 2 — Bénéficiaire**
- Recherche par numéro de pièce ou par nom → si le client existe déjà, tout est prérempli
- Sinon : nom, type et numéro de pièce, téléphone, photo de la pièce

**Bloc 3 — Remise**
- Devise voulue : deux boutons USD / HTG. Si le canal est `TRANSFER_HTG`, le bouton USD est **désactivé avec l'explication affichée** (« virement en gourdes : remise en gourdes uniquement »).
- Récapitulatif calculé automatiquement, en gros caractères :

```
  Montant reçu        500.00 USD
  Frais (10 %)        −50.00 USD
  Taux appliqué       133.0000
  ─────────────────────────────
  À REMETTRE          59 850 HTG
```

Le caissier ne saisit **jamais** les frais, le taux ni le montant à remettre. Ces champs sont en lecture seule.

Bouton **Enregistrer** → statut `RECEIVED`.

### 7.4 Vérification et paiement
- Écran listant les transactions en attente.
- Bouton **Vérifié** (la caissière a confirmé la réception sur le compte Zelle/CashApp) → `VERIFIED`.
- Bouton **Payer** → demande confirmation du montant, crée le `CashMovement` de sortie correspondant, passe en `PAID`, imprime le reçu.
- **Procuration (confirmé 2026-07-28)** : case à cocher optionnelle « Retiré par quelqu'un d'autre ». Si cochée, saisie du nom + type/numéro de pièce de la personne qui se présente réellement au guichet (`Transaction.collectedById`, résolution find-or-create comme pour le bénéficiaire). Le reçu et la page de détail affichent alors le bénéficiaire visé **et** la personne ayant réellement retiré l'argent.
- **Le paiement est impossible si aucune caisse commune n'est ouverte.**

### 7.5 Reçu
- Format ticket 80 mm (imprimante thermique) **et** A5 PDF en repli.
- Contenu : nom de l'entreprise, numéro de reçu, date/heure, canal, référence, expéditeur, bénéficiaire + numéro de pièce, montant reçu, frais, taux, montant remis, nom du caissier, ligne de signature du client.
- Deux exemplaires : client et archive.
- Bouton secondaire « Envoyer par WhatsApp » → ouvre `https://wa.me/<numéro>?text=<récapitulatif>`. Pas d'intégration API WhatsApp en phase 1, c'est un lien.

### 7.6 Caisse commune

**Confirmé par le client (2026-07-28) : ce n'est pas une caisse par caissier.** Les agents qui traitent les transactions (créer, vérifier, payer) ne gèrent pas leur propre caisse — l'argent physique remis aux clients vient d'une caisse **partagée**, gérée par un autre service. Le comptage/liquide fluctue en cours de journée : un livreur apporte des apports de cash (USD et HTG) pour renflouer les liquidités.

- **Ouverture** : réservée à l'**ADMIN**. Il saisit le fonds de départ en USD et en HTG pour la caisse commune de la période. Obligatoire avant toute opération de paiement (par n'importe quel agent).
- **Apport de liquidités** : l'ADMIN peut ajouter un mouvement d'entrée (USD ou HTG) à tout moment pendant que la caisse est ouverte, pour refléter une livraison de cash.
- **Paiement** : quel que soit l'agent qui clique sur *Payer*, le mouvement de sortie est imputé à la caisse commune actuellement ouverte ; l'agent qui a effectué la remise reste tracé sur le mouvement (`CashMovement.createdById`), distinct de qui a ouvert la caisse.
- **Clôture** : réservée à l'ADMIN. Le système affiche le solde théorique par devise (fonds de départ + apports − remises) ; l'ADMIN saisit le montant réellement compté ; l'écart est calculé et exige une note s'il n'est pas nul. Session verrouillée après clôture.
- Une seule caisse commune peut être ouverte à la fois.

### 7.7 Administration (ADMIN)
- Grille tarifaire : tableau des 8 combinaisons canal × devise, modifiable. Chaque modification demande confirmation et journalise l'auteur. **Affiche un aperçu du calcul sur un montant de 500 USD avant validation** — c'est le garde-fou contre une faute de frappe sur le taux.
- Utilisateurs : création, désactivation, réinitialisation de mot de passe. Jamais de suppression.
- Journal d'audit : consultable, filtrable par utilisateur et par date.

### 7.8 Rapports
- Journalier : volume transféré par canal et par devise, total des frais encaissés, **marge de change** (différence entre le taux appliqué au client et le taux de référence du marché saisi par l'administrateur), écarts de caisse.
- Mensuel : mêmes indicateurs agrégés, par caissier.
- Export Excel de toute liste affichée. **Important pour la conduite du changement** : ils doivent sentir qu'ils ne perdent rien de leurs habitudes.
  - **Choix technique** : export en CSV (avec BOM UTF-8, séparateur `;`) plutôt qu'un vrai `.xlsx` généré par une librairie (`xlsx`/`exceljs`). Excel ouvre le CSV nativement — même expérience utilisateur — sans les vulnérabilités de sécurité connues des générateurs `.xlsx` disponibles sur npm à cette date. Implémenté sur : tableau de bord, journal d'audit, rapport journalier, rapport mensuel.

### 7.9 Registre MonCash / NatCash

**Confirmé par le client (2026-08-16).** L'entreprise agit aussi comme agent MonCash (Digicel) et NatCash (Natcom) : la BRH impose aux agents de tenir un cahier listant toutes les opérations effectuées au guichet. C'est un processus **distinct** du transfert diaspora (`Transaction`) : pas d'identité client vérifiée par pièce, pas de calcul de frais côté OpsDesk (les frais MonCash/NatCash sont fixés par le réseau, non modifiables par l'agent, connus de tous), pas de mouvement de caisse OpsDesk (l'agent gère son solde MonCash/NatCash séparément). Modélisé par un modèle Prisma dédié, `MobileMoneyOperation`, pas une extension du `Channel` existant.

Trois types d'opération, avec les champs exigés par la BRH :
- **Retrait** (client retire de son compte) : numéro du client + montant.
- **Dépôt** (client dépose sur son compte) : numéro du client + montant.
- **Transfert** (client envoie à un autre client du réseau, au guichet) : numéro du client + numéro du destinataire + montant.

Règles retenues :
- Montants en **gourdes (HTG) uniquement**.
- Registre **append-only** : comme `audit_logs`, une opération enregistrée ne peut plus être modifiée ni supprimée (contrainte imposée en base par trigger, pas seulement côté application) — cohérent avec la nature d'un cahier physique.
- Écran dédié `/mobile-money`, accessible à tous les rôles authentifiés (CASHIER compris, ce sont eux qui tiennent le cahier au quotidien) : formulaire de saisie + liste du jour avec filtres (réseau, type d'opération, navigation jour par jour) + export Excel (même mécanisme CSV que les autres rapports, cf. §7.8).

---

## 8. Reprise de l'existant

Écrire un script d'import du fichier Excel actuel :
- Lecture de la feuille, mapping des colonnes vers `Transaction`, création des `Client` manquants.
- Les transactions importées reçoivent le statut `PAID` et un marqueur `importedFromLegacy = true`.
- Le script est **idempotent** et produit un rapport des lignes rejetées avec le motif. Ne jamais rejeter en silence.
- Demander le fichier réel avant d'écrire ce script — n'invente pas la structure des colonnes.

---

## 9. Sauvegarde et continuité

- Sauvegardes automatiques de la base via les snapshots/point-in-time recovery de Railway, complétées par un `pg_dump` chiffré (age ou gpg) programmé toutes les 6 heures, conservé 30 jours dans le stockage objet.
- Les pièces jointes (captures, photos de pièces) résident sur Cloudinary ; un export périodique (liste des `publicId` + téléchargement) est inclus dans la sauvegarde pour ne pas dépendre uniquement de la rétention du compte Cloudinary.
- **Une restauration doit être testée avant la mise en production.** Une sauvegarde jamais restaurée n'est pas une sauvegarde.
- PostgreSQL managé : `fsync` activé par défaut côté fournisseur, ne pas le désactiver pour gagner en performance.

---

## 10. Sécurité

- Mots de passe : argon2id, longueur minimale 10 caractères, changement obligatoire à la première connexion.
- Sessions : cookie httpOnly, SameSite=Lax, expiration 12 h, invalidation à la désactivation du compte.
- Photos de pièces d'identité : stockées hors de la racine web, servies uniquement via une route authentifiée qui vérifie le rôle.
- HTTPS sur le LAN via certificat auto-signé installé sur les postes, ou à défaut accès restreint au réseau filaire. Documenter le choix retenu.
- Verrouillage du compte après 10 tentatives échouées.
- Aucune donnée client dans les logs applicatifs.

---

## 11. Plan de livraison

| Jalon | Contenu | Critère de recette |
|---|---|---|
| **M1** | Schéma Prisma, migrations, seed de la grille tarifaire, moteur de calcul + tests unitaires exhaustifs | Les 8 combinaisons canal × devise donnent le montant exact attendu ; le cas interdit est rejeté |
| **M2** | Auth, rôles, utilisateurs, journal d'audit | Un CASHIER ne peut pas atteindre les écrans admin, même en tapant l'URL |
| **M3** | Création de transaction, anti-doublon, pièces jointes, clients | Une référence déjà utilisée est refusée avec un message clair |
| **M4** | Vérification, paiement, reçu imprimable | Un paiement sans caisse ouverte est impossible |
| **M5** | Ouverture / clôture de caisse, mouvements, écarts | Le solde théorique correspond aux mouvements de la journée |
| **M6** ✅ | Rapports, export Excel, écran de grille tarifaire | Le changement de taux n'altère aucune transaction passée — vérifié : l'ancienne règle Zelle→HTG à 133 reste inchangée sur les transactions déjà créées après passage à 135 |
| **M7** | Import de l'historique Excel, sauvegardes, déploiement Docker, formation | Restauration complète testée sur une machine vierge |

Les phases 2 (services légaux) et 3 (produits et stock) ne sont **pas** dans ce périmètre. Conçois toutefois `CashSession` et `CashMovement` pour accueillir plus tard des mouvements d'autres origines — c'est déjà prévu par le champ `reason`.

---

## 12. Exigences de qualité

- Tests unitaires **obligatoires et exhaustifs** sur le moteur de calcul : c'est le composant dont une erreur coûte de l'argent réel à chaque transaction. Couvre les 8 combinaisons, les arrondis, les montants limites, le cas interdit.
- Tests Playwright sur trois parcours : créer et payer une transaction ; tenter un doublon ; ouvrir et clôturer une caisse avec écart.
- Toute la logique de calcul dans un module pur (`lib/pricing.ts`), sans accès base de données, testable isolément.
- Interface intégralement en français, y compris les messages d'erreur.
- Formatage des montants : espace insécable comme séparateur de milliers, `59 850 HTG`, `500.00 USD`.

---

## 13. Points à confirmer avec le client avant de coder

1. ~~Pour Zelle et CashApp en gourdes : frais prélevés avant ou après la conversion ?~~ **Confirmé 2026-07-28 : avant.** Voir §4.3.
2. Arrondi du montant remis en gourdes : à la gourde, ou à 5 HTG ?
3. Existe-t-il un montant plafond au-delà duquel une validation du superviseur est requise ?
4. La commission est-elle parfois négociée pour les gros montants ou les clients réguliers ? Si oui, il faut un champ de dérogation tracé et réservé au superviseur.
5. ~~Y a-t-il un cas où le bénéficiaire n'est pas la personne dont on prend la pièce (procuration) ?~~ **Confirmé 2026-07-28 : oui.** Voir §7.4.
6. ~~Numéro de téléphone et nom exact de l'entreprise pour l'en-tête du reçu.~~ **Confirmé 2026-07-28 : Kmat Supply, +509 34 40 3636 / 36 00 1818.**
7. Le fichier Excel actuel, pour écrire le script d'import.

---

## 14. Remarque de conformité

Cette activité relève de la réglementation des transferts de fonds en Haïti. Le système conserve un historique complet et inaltérable des opérations, des pièces d'identité et des montants — ce qui va dans le sens des obligations de conservation. Vérifier auprès de la BRH les exigences applicables (durée de conservation, seuils de déclaration) et les intégrer avant la mise en production. **Ne rien promettre au client en matière de conformité tant que ce point n'est pas vérifié.**
