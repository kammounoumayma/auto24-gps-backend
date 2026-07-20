# Auto24 GPS — Backend

API backend pour l'application mobile Auto24 GPS, un système de suivi GPS de véhicules en temps réel.

## Stack technique

- **Node.js** + **Express** — API REST
- **PostgreSQL** (via Docker) — base de données
- **WebSocket** (`ws`) — suivi de position en temps réel
- **JWT** + **bcrypt** — authentification sécurisée

## Structure du projet

src/
├── config/ # Connexion base de données, schéma SQL, données de test
├── controllers/ # Logique métier de chaque route
├── routes/ # Définition des endpoints API
├── middlewares/ # Authentification JWT
├── websocket/ # Serveur WebSocket pour le suivi temps réel
└── index.js # Point d'entrée du serveur

## Installation

```bash
npm install
```

## Configuration

Crée un fichier `.env` à la racine avec :
```env
PORT=3000
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5433/auto24_gps
JWT_SECRET=votre_secret_aleatoire
```

## Base de données (Docker)

```bash
docker run --name auto24-postgres -e POSTGRES_PASSWORD=VOTRE_MOT_DE_PASSE -e POSTGRES_DB=auto24_gps -p 5433:5432 -d postgres:16
```

Créer les tables :
```bash
Get-Content src/config/schema.sql | docker exec -i auto24-postgres psql -U postgres -d auto24_gps
```

Ajouter des données de test :
```bash
node src/config/seed.js
```

## Lancer le serveur

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`.

## Endpoints principaux

| Méthode | Route | Description | Authentification |
|---|---|---|---|
| POST | `/api/login` | Connexion utilisateur | Non |
| GET | `/api/vehicles` | Liste des véhicules | Oui |
| GET | `/api/vehicles/:id` | Détail d'un véhicule | Oui |
| PUT | `/api/vehicles/:id` | Modifier un véhicule | Oui |
| GET | `/api/alerts` | Liste des alertes | Oui |
| GET | `/api/trips` | Historique des trajets | Oui |
| WS | `/ws/tracking?token=` | Flux temps réel de position | Oui (token en query) |

## Utilisateur de test

- Email : `admin@gpsauto24.com`
- Mot de passe : `password123`