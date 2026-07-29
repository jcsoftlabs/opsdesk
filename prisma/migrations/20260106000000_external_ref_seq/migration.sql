-- Référence de transaction générée par le système (confirmé 2026-07-28) :
-- le numéro de confirmation Zelle/CashApp n'apparaît pas toujours dans les
-- captures d'écran (surtout CashApp), donc plus de saisie manuelle. Une
-- séquence partagée garantit l'unicité ; le préfixe par canal est ajouté
-- côté application (src/lib/pricing.ts).
CREATE SEQUENCE "external_ref_seq" START 1;
