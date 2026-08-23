-- ============================================================
-- SanteTravail.CI - Migration Décret N°2026-206 du 15 Avril 2026
-- Adaptation aux exigences légales ivoiriennes
-- ============================================================

-- TABLE: Registre de visite journalière (Art. 7 & 29)
-- Obligatoire dans tout établissement d'au moins 100 travailleurs
CREATE TABLE IF NOT EXISTS registre_journalier (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_visite DATE NOT NULL DEFAULT (date('now')),
  heure_visite TIME DEFAULT (time('now')),
  travailleur_id INTEGER REFERENCES travailleurs(id),
  praticien_id INTEGER REFERENCES users(id),
  nom_patient TEXT,           -- peut être un patient non enregistré
  prenom_patient TEXT,
  matricule TEXT,
  age INTEGER,
  sexe TEXT CHECK(sexe IN ('M', 'F')),
  poste_travail TEXT,
  diagnostic TEXT,
  soins_donnes TEXT,
  observations TEXT,
  entreprise_id INTEGER REFERENCES entreprises(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Certificats d'aptitude / d'inaptitude (Art. 25, 26, 27)
-- Toute visite réglementaire (sauf journalière) doit être sanctionnée par un certificat
CREATE TABLE IF NOT EXISTS certificats_aptitude (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_certificat TEXT UNIQUE NOT NULL,  -- Numéro unique obligatoire
  visite_id INTEGER REFERENCES visites_medicales(id),
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  medecin_id INTEGER REFERENCES users(id),
  date_emission DATE NOT NULL DEFAULT (date('now')),
  type_certificat TEXT NOT NULL CHECK(type_certificat IN ('aptitude', 'inaptitude', 'aptitude_avec_restriction')),
  aptitude TEXT NOT NULL CHECK(aptitude IN ('apte', 'apte_amenagement', 'apte_temporaire', 'inapte_temporaire', 'inapte_definitif')),
  -- Conditions d'inaptitude (Art. 26: 2 examens + étude de poste requis)
  etude_poste_realisee INTEGER DEFAULT 0,      -- Art. 26: étude du poste obligatoire
  etude_conditions_realisee INTEGER DEFAULT 0,  -- Art. 26: étude des conditions de travail
  deux_examens_realises INTEGER DEFAULT 0,      -- Art. 26: 2 examens espacés de 2 semaines
  date_premier_examen DATE,
  date_deuxieme_examen DATE,
  -- Contenu du certificat
  poste_travail TEXT,
  restrictions TEXT,          -- Restrictions spécifiques
  amenagements TEXT,          -- Aménagements de poste préconisés
  motif_inaptitude TEXT,      -- Motifs consignés au dossier (Art. 27)
  validite_mois INTEGER DEFAULT 12,  -- Durée de validité en mois
  date_expiration DATE,
  -- Contestation (Art. 28: délai 2 mois)
  conteste INTEGER DEFAULT 0,
  date_contestation DATE,
  motif_contestation TEXT,
  statut_contestation TEXT CHECK(statut_contestation IN ('en_cours', 'accepte', 'rejete')),
  observations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Maladies professionnelles & accidents du travail (Art. 11, 14)
-- Déclaration obligatoire dans les 24h (Art. 30)
CREATE TABLE IF NOT EXISTS maladies_accidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  type_evenement TEXT NOT NULL CHECK(type_evenement IN ('maladie_professionnelle', 'accident_travail', 'maladie_infectieuse', 'maladie_contagieuse')),
  date_evenement DATE NOT NULL,
  date_declaration DATE,       -- Date de déclaration aux autorités
  declare_24h INTEGER DEFAULT 0, -- Art. 30: notification dans 24h obligatoire
  medecin_chef_notifie INTEGER DEFAULT 0,
  inspecteur_travail_notifie INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  lieu TEXT,
  circonstances TEXT,
  lesions TEXT,
  jours_arret INTEGER DEFAULT 0,
  taux_incapacite REAL,
  prise_charge_employeur INTEGER DEFAULT 0,  -- Art. 10: évacuation à la charge de l'employeur
  formation_sanitaire_evacuation TEXT,
  statut TEXT DEFAULT 'declare' CHECK(statut IN ('declare', 'en_cours', 'clos', 'contentieux')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Fiche d'entreprise - Risques professionnels (Art. 12, 14)
-- Tiers-temps technique obligatoire: visite des lieux, étude des postes, identification des risques
CREATE TABLE IF NOT EXISTS fiche_entreprise (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
  medecin_id INTEGER REFERENCES users(id),
  date_creation DATE DEFAULT (date('now')),
  date_mise_a_jour DATE,
  -- Effectifs (Art. 31: classification en 5 catégories)
  effectif_total INTEGER,
  effectif_travailleurs_loges INTEGER DEFAULT 0,   -- Art. 2: familles logées comptées
  effectif_femmes_enceintes INTEGER DEFAULT 0,
  categorie_entreprise TEXT CHECK(categorie_entreprise IN ('1ere', '2eme', '3eme', '4eme', '5eme')),
  -- Type de service (Art. 3)
  type_service TEXT CHECK(type_service IN ('autonome', 'interentreprises')),
  numero_agrement TEXT,        -- Art. 36: agrément obligatoire
  date_agrement DATE,
  -- Hygiène générale (Art. 12.1)
  climatisation TEXT,
  eclairage TEXT,
  installations_sanitaires TEXT,
  eau_boisson_conforme INTEGER DEFAULT 0,
  cantine_conforme INTEGER DEFAULT 0,
  -- Risques professionnels identifiés (Art. 12.2, 12.3)
  risques_poussières TEXT,
  risques_vapeurs TEXT,
  risques_bruit TEXT,
  risques_chimiques TEXT,
  risques_biologiques TEXT,
  risques_rayonnements TEXT,
  risques_ergonomiques TEXT,
  autres_risques TEXT,
  -- Dispositifs de sécurité (Art. 12.3)
  epi_disponibles TEXT,
  dispositifs_securite TEXT,
  -- Logement travailleurs (Art. 12.6)
  travailleurs_loges INTEGER DEFAULT 0,
  conditions_logement TEXT,
  -- Mesures préventives (Art. 11)
  mesures_prevention TEXT,
  programme_formation_securite TEXT,
  -- Equipement médical
  type_equipement TEXT CHECK(type_equipement IN ('service_medical_autonome', 'infirmerie', 'trousse_secours')),
  stock_medicaments_conforme INTEGER DEFAULT 0,   -- Art. 36, 38, 40 + Annexes
  observations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Visites de tiers-temps (Art. 6 - "tiers temps technique")
-- Le médecin consacre 1/3 de son temps à des missions en milieu de travail
CREATE TABLE IF NOT EXISTS tiers_temps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medecin_id INTEGER REFERENCES users(id),
  entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
  date_visite DATE NOT NULL,
  type_mission TEXT NOT NULL CHECK(type_mission IN (
    'visite_lieux_travail',       -- Art. 14a
    'etude_poste',                -- Art. 14b + Art. 26
    'identification_risques',     -- Art. 14c
    'mise_a_jour_fiche',          -- Art. 14d
    'conseils_secours',           -- Art. 14e
    'reunion_csst',               -- Art. 14f - Comité Sécurité Santé Travail
    'metrologie_ambiance',        -- Art. 14g
    'campagne_sensibilisation',   -- Art. 14h
    'enquete_epidemiologique',    -- Art. 14i
    'formation_risques',          -- Art. 14j
    'etude_nouvelle_technique',   -- Art. 14k
    'formation_securite',         -- Art. 14l
    'enquete_accident'            -- Art. 14m
  )),
  duree_heures REAL DEFAULT 1,
  postes_visites TEXT,
  risques_identifies TEXT,
  recommandations TEXT,
  mesures_prises TEXT,
  compte_rendu TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Rapport annuel (Art. 30.1)
-- Obligatoire: envoyé à l'Inspecteur du Travail + Médecin Inspecteur
CREATE TABLE IF NOT EXISTS rapports_annuels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medecin_id INTEGER REFERENCES users(id),
  entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
  annee INTEGER NOT NULL,
  -- Statistiques obligatoires
  nb_travailleurs_total INTEGER,
  nb_travailleurs_loges INTEGER DEFAULT 0,
  nb_visites_embauche INTEGER DEFAULT 0,
  nb_visites_periodiques INTEGER DEFAULT 0,
  nb_visites_reprise INTEGER DEFAULT 0,
  nb_visites_journalieres INTEGER DEFAULT 0,
  nb_visites_spontanees INTEGER DEFAULT 0,
  nb_visites_speciales INTEGER DEFAULT 0,
  nb_consultations_total INTEGER DEFAULT 0,
  nb_maladies_professionnelles INTEGER DEFAULT 0,
  nb_accidents_travail INTEGER DEFAULT 0,
  nb_maladies_contagieuses INTEGER DEFAULT 0,
  -- Inaptitudes
  nb_aptes INTEGER DEFAULT 0,
  nb_aptes_restriction INTEGER DEFAULT 0,
  nb_inaptes_temporaires INTEGER DEFAULT 0,
  nb_inaptes_definitifs INTEGER DEFAULT 0,
  -- Activités préventives (Art. 11)
  nb_tiers_temps_visites INTEGER DEFAULT 0,
  nb_campagnes_sensibilisation INTEGER DEFAULT 0,
  nb_formations_securite INTEGER DEFAULT 0,
  -- Examens complémentaires (Art. 21)
  nb_examens_biologie INTEGER DEFAULT 0,
  nb_examens_imagerie INTEGER DEFAULT 0,
  nb_examens_audiometrie INTEGER DEFAULT 0,
  nb_examens_spirometrie INTEGER DEFAULT 0,
  -- Contenu narratif du rapport
  bilan_activites TEXT,
  problemes_rencontres TEXT,
  recommandations TEXT,
  programme_annee_suivante TEXT,
  -- Transmission (Art. 30.1)
  date_transmission_inspecteur DATE,
  date_transmission_medecin_inspecteur DATE,
  statut TEXT DEFAULT 'brouillon' CHECK(statut IN ('brouillon', 'finalise', 'transmis')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entreprise_id, annee)
);

-- TABLE: Comptes-rendus trimestriels (Art. 30.2)
-- Obligatoire chaque trimestre: médecin chef + inspecteur travail
CREATE TABLE IF NOT EXISTS comptes_rendus_trimestriels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medecin_id INTEGER REFERENCES users(id),
  entreprise_id INTEGER NOT NULL REFERENCES entreprises(id),
  annee INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3, 4)),
  nb_visites_periode INTEGER DEFAULT 0,
  nb_consultations_periode INTEGER DEFAULT 0,
  nb_maladies_declarees INTEGER DEFAULT 0,
  nb_accidents_periode INTEGER DEFAULT 0,
  activites_preventives TEXT,
  observations TEXT,
  date_transmission_medecin_chef DATE,
  date_transmission_inspecteur DATE,
  statut TEXT DEFAULT 'brouillon' CHECK(statut IN ('brouillon', 'finalise', 'transmis')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entreprise_id, annee, trimestre)
);

-- TABLE: Examens complémentaires (Art. 21, 22, 23, 24)
-- À la charge de l'employeur; temps sur heures de travail
ALTER TABLE examens ADD COLUMN charge_employeur INTEGER DEFAULT 1;
ALTER TABLE examens ADD COLUMN frais_transport_pris_en_charge INTEGER DEFAULT 1;
ALTER TABLE examens ADD COLUMN pendant_heures_travail INTEGER DEFAULT 1;
ALTER TABLE examens ADD COLUMN prescription_medicale TEXT;
ALTER TABLE examens ADD COLUMN en_desaccord INTEGER DEFAULT 0; -- Art. 23: désaccord employeur/médecin
ALTER TABLE examens ADD COLUMN decision_medecin_inspecteur TEXT; -- Art. 23

-- Nouvelles colonnes pour les travailleurs (Art. 2, 4)
ALTER TABLE travailleurs ADD COLUMN type_contrat TEXT DEFAULT 'permanent' CHECK(type_contrat IN ('permanent', 'apprenti', 'essai', 'journalier', 'determine', 'domicile', 'saisonnier'));
ALTER TABLE travailleurs ADD COLUMN loge_par_employeur INTEGER DEFAULT 0;   -- Art. 2: familles logées
ALTER TABLE travailleurs ADD COLUMN categorie_risque TEXT DEFAULT 'standard' CHECK(categorie_risque IN ('standard', 'eleve', 'tres_eleve', 'femme_enceinte', 'enfant'));
ALTER TABLE travailleurs ADD COLUMN frequence_visite_mois INTEGER DEFAULT 12; -- Art. 8: fréquence rapprochée pour certains

-- Nouvelles colonnes pour les entreprises
ALTER TABLE entreprises ADD COLUMN effectif INTEGER;
ALTER TABLE entreprises ADD COLUMN categorie TEXT CHECK(categorie IN ('1ere', '2eme', '3eme', '4eme', '5eme'));
ALTER TABLE entreprises ADD COLUMN type_service_sante TEXT DEFAULT 'autonome' CHECK(type_service_sante IN ('autonome', 'interentreprises'));
ALTER TABLE entreprises ADD COLUMN numero_agrement TEXT;
ALTER TABLE entreprises ADD COLUMN date_agrement DATE;
ALTER TABLE entreprises ADD COLUMN type_equipement TEXT DEFAULT 'trousse_secours' CHECK(type_equipement IN ('service_medical_autonome', 'infirmerie', 'trousse_secours'));

-- Index
CREATE INDEX IF NOT EXISTS idx_registre_date ON registre_journalier(date_visite);
CREATE INDEX IF NOT EXISTS idx_registre_entreprise ON registre_journalier(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_certificats_travailleur ON certificats_aptitude(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_certificats_visite ON certificats_aptitude(visite_id);
CREATE INDEX IF NOT EXISTS idx_maladies_travailleur ON maladies_accidents(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_tiers_temps_date ON tiers_temps(date_visite);
CREATE INDEX IF NOT EXISTS idx_rapports_annee ON rapports_annuels(annee);
