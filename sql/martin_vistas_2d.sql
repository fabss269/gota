CREATE OR REPLACE VIEW gota.agua_2d AS
SELECT aguaid, ST_Force2D(geom) AS geom, aguatipoid, sectorid, diametro
FROM sig.agua;

CREATE OR REPLACE VIEW gota.alcantarillado_2d AS
SELECT alcantarilladoid, ST_Force2D(geom) AS geom, codigo, alcantarilladotipoid,
       materialid, primaria, sectorid, distritoid
FROM sig.alcantarillado;
