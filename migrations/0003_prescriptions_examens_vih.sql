-- ============================================================
-- SanteTravail.CI — Migration 0003
-- Prescriptions structurées, examens prescrits, attestations VIH
-- ============================================================

-- Amélioration table prescriptions : ajout visite_id + lignes médicament structurées
ALTER TABLE prescriptions ADD COLUMN visite_id INTEGER REFERENCES visites_medicales(id);
ALTER TABLE prescriptions ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE prescriptions ADD COLUMN numero_ordonnance TEXT;
ALTER TABLE prescriptions ADD COLUMN statut TEXT DEFAULT 'active' CHECK(statut IN ('active','dispensee','annulee'));
ALTER TABLE prescriptions ADD COLUMN renouvellement INTEGER DEFAULT 0;

-- Table lignes d'ordonnance (1 ligne = 1 médicament)
CREATE TABLE IF NOT EXISTS ordonnance_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id),
  medicament TEXT NOT NULL,
  forme TEXT,            -- comprimé, sirop, injectable, pommade...
  dosage TEXT,           -- ex: 500mg
  posologie TEXT NOT NULL, -- ex: 1 cp matin et soir
  duree TEXT,            -- ex: 7 jours
  quantite TEXT,         -- ex: 2 boîtes
  voie TEXT DEFAULT 'orale' CHECK(voie IN ('orale','injectable','topique','inhalation','autre')),
  instructions TEXT,     -- ex: prendre pendant les repas
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Amélioration table examens : ajout visite_id + tenant_id
ALTER TABLE examens ADD COLUMN visite_id INTEGER REFERENCES visites_medicales(id);
ALTER TABLE examens ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE examens ADD COLUMN laboratoire TEXT;
ALTER TABLE examens ADD COLUMN urgent INTEGER DEFAULT 0;
ALTER TABLE examens ADD COLUMN statut TEXT DEFAULT 'prescrit' CHECK(statut IN ('prescrit','en_cours','resultat_recu','annule'));
ALTER TABLE examens ADD COLUMN numero_bon TEXT;

-- Table attestations VIH/SIDA (test de dépistage)
CREATE TABLE IF NOT EXISTS attestations_vih (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  travailleur_id INTEGER NOT NULL REFERENCES travailleurs(id),
  medecin_id INTEGER REFERENCES users(id),
  visite_id INTEGER REFERENCES visites_medicales(id),
  consultation_id INTEGER REFERENCES consultations(id),
  numero_attestation TEXT UNIQUE NOT NULL,
  date_test DATE NOT NULL DEFAULT (date('now')),
  -- Counseling pré-test
  counseling_pre_realise INTEGER DEFAULT 1,
  consentement_eclaire INTEGER DEFAULT 1,
  -- Résultat (confidentiel — ne jamais afficher le résultat directement)
  resultat_communique INTEGER DEFAULT 0,  -- 1 si résultat remis au patient
  counseling_post_realise INTEGER DEFAULT 0,
  -- Orientations
  oriente_prise_charge INTEGER DEFAULT 0,
  structure_orientation TEXT,
  -- L'attestation ne mentionne jamais le résultat — juste que le test a été réalisé
  -- conformément au protocole national de dépistage VIH/SIDA
  observations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX IF NOT EXISTS idx_prescriptions_visite ON prescriptions(visite_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_travailleur ON prescriptions(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_ordonnance_lignes_prescription ON ordonnance_lignes(prescription_id);
CREATE INDEX IF NOT EXISTS idx_examens_visite ON examens(visite_id);
CREATE INDEX IF NOT EXISTS idx_examens_travailleur ON examens(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_attestations_vih_travailleur ON attestations_vih(travailleur_id);
CREATE INDEX IF NOT EXISTS idx_attestations_vih_visite ON attestations_vih(visite_id);
