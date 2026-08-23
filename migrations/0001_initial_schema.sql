-- ============================================================
-- SanteTravail.CI - Schéma Initial de la Base de Données
-- Médecine du Travail - Gestion des Dossiers Médicaux
-- ============================================================

-- Table des utilisateurs (médecins, infirmiers, admins)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'medecin', 'infirmier')),
  specialite TEXT,
  telephone TEXT,
  actif INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des entreprises
CREATE TABLE IF NOT EXISTS entreprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  secteur TEXT,
  adresse TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT,
  contact_rh TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des travailleurs (patients)
CREATE TABLE IF NOT EXISTS travailleurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  sexe TEXT CHECK(sexe IN ('M', 'F')),
  numero_matricule TEXT UNIQUE,
  poste TEXT,
  entreprise_id INTEGER REFERENCES entreprises(id),
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  groupe_sanguin TEXT,
  allergies TEXT,
  antecedents_personnels TEXT,
  antecedents_familiaux TEXT,
  traitement_en_cours TEXT,
  date_embauche DATE,
  statut TEXT DEFAULT 'actif' CHECK(statut IN ('actif', 'inactif', 'suspendu')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des visites médicales
CREATE TABLE IF NOT EXISTS visites_medicales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  medecin_id INTEGER REFERENCES users(id),
  type_visite TEXT NOT NULL CHECK(type_visite IN ('embauche', 'periodique', 'reprise', 'spontanee', 'pre_reprise')),
  date_visite DATE NOT NULL,
  heure_visite TIME,
  statut TEXT DEFAULT 'planifiee' CHECK(statut IN ('planifiee', 'realisee', 'annulee', 'reportee')),
  motif TEXT,
  conclusions TEXT,
  aptitude TEXT CHECK(aptitude IN ('apte', 'apte_amenagement', 'apte_temporaire', 'inapte_temporaire', 'inapte_definitif')),
  restrictions TEXT,
  prochaine_visite DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des consultations
CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  praticien_id INTEGER REFERENCES users(id),
  date_consultation DATETIME NOT NULL,
  motif TEXT NOT NULL,
  symptomes TEXT,
  examen_clinique TEXT,
  diagnostic TEXT,
  traitement TEXT,
  prescriptions TEXT,
  examens_demandes TEXT,
  certificat_travail INTEGER DEFAULT 0,
  arret_travail_jours INTEGER DEFAULT 0,
  observations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des constantes vitales
CREATE TABLE IF NOT EXISTS constantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  consultation_id INTEGER REFERENCES consultations(id),
  date_mesure DATETIME DEFAULT CURRENT_TIMESTAMP,
  poids REAL,
  taille REAL,
  imc REAL,
  tension_systolique INTEGER,
  tension_diastolique INTEGER,
  frequence_cardiaque INTEGER,
  temperature REAL,
  saturation_oxygene REAL,
  glycemie REAL,
  notes TEXT
);

-- Table des prescriptions/ordonnances
CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_id INTEGER REFERENCES consultations(id),
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  medecin_id INTEGER REFERENCES users(id),
  date_prescription DATE DEFAULT CURRENT_DATE,
  medicaments TEXT NOT NULL,
  posologie TEXT,
  duree TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des examens complémentaires
CREATE TABLE IF NOT EXISTS examens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  consultation_id INTEGER REFERENCES consultations(id),
  type_examen TEXT NOT NULL CHECK(type_examen IN ('biologie', 'imagerie', 'audiometrie', 'spirometrie', 'autre')),
  nom_examen TEXT NOT NULL,
  date_demande DATE,
  date_resultat DATE,
  resultat TEXT,
  interpretation TEXT,
  fichier_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des alertes médicales
CREATE TABLE IF NOT EXISTS alertes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER REFERENCES travailleurs(id),
  type_alerte TEXT NOT NULL CHECK(type_alerte IN ('visite_echeance', 'suivi_requis', 'risque_expose', 'autre')),
  message TEXT NOT NULL,
  priorite TEXT DEFAULT 'normale' CHECK(priorite IN ('basse', 'normale', 'haute', 'urgente')),
  statut TEXT DEFAULT 'active' CHECK(statut IN ('active', 'traitee', 'ignoree')),
  date_echeance DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_travailleurs_entreprise ON travailleurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_visites_travailleur ON visites_medicales(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_visites_date ON visites_medicales(date_visite);
CREATE INDEX IF NOT EXISTS idx_consultations_travailleur ON consultations(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(date_consultation);
CREATE INDEX IF NOT EXISTS idx_constantes_travailleur ON constantes(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_alertes_statut ON alertes(statut);
