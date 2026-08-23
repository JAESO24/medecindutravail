-- ============================================================
-- SanteTravail.CI - Utilisateurs (base vierge, sans données de démo)
-- ============================================================

-- Utilisateurs (mot de passe: Admin123! hashé en SHA256 simulé)
INSERT OR IGNORE INTO users (nom, prenom, email, password_hash, role, specialite, telephone) VALUES
  ('KONAN', 'Dr. Kouadio', 'admin@santetravail.ci', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'admin', 'Médecine du Travail', '+225 07 00 00 01'),
  ('BAMBA', 'Dr. Fatoumata', 'medecin@santetravail.ci', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'medecin', 'Médecine Générale', '+225 07 00 00 02'),
  ('OUATTARA', 'Inf. Aminata', 'infirmier@santetravail.ci', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'infirmier', 'Soins Infirmiers', '+225 07 00 00 03');
