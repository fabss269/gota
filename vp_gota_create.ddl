-- GOTA pasa a vivir como esquema dentro de bd_conhydra (producción), junto al
-- esquema `sig` ya existente — no se toca `sig` en absoluto, ni el resto de la BD.
CREATE SCHEMA IF NOT EXISTS gota;
SET search_path TO gota;

create table alerta_regla (
  alerta_regla_id serial not null, 
  codigo          varchar(50) not null unique, 
  nombre          varchar(100) not null, 
  descripcion     text, 
  umbral_valor    numeric(19, 2), 
  umbral_unidad   varchar(20), 
  activa          BOOLEAN default TRUE not null, 
  tipo_alertaid   int4 not null, 
  peso            numeric(19, 0) not null, 
  primary key (alerta_regla_id));
create table area (
  area_id   serial not null, 
  codigo    varchar(30) not null unique, 
  nombre    varchar(50) not null, 
  color_hex varchar(7), 
  activo    BOOLEAN default TRUE not null, 
  primary key (area_id));
create table catalogo_alcance (
  alcance_id serial not null, 
  codigo     varchar(20) not null unique, 
  nombre     varchar(50) not null, 
  primary key (alcance_id));
create table catalogo_equipo (
  equipo_id   serial not null, 
  codigo      varchar(20) not null unique, 
  nombre      varchar(50) not null, 
  descripcion text, 
  activo      BOOLEAN default TRUE not null, 
  primary key (equipo_id));
create table catalogo_estado (
  estado_id serial not null, 
  codigo    varchar(30) not null unique, 
  nombre    varchar(50) not null, 
  color_hex varchar(7), 
  orden     INT default 0 not null, 
  activo    BOOLEAN default TRUE not null, 
  primary key (estado_id));
create table catalogo_medio_recepcion (
  medio_recepcion_id serial not null, 
  codigo             varchar(30) not null unique, 
  nombre             varchar(50) not null, 
  primary key (medio_recepcion_id));
create table catalogo_motivo (
  motivo_id serial not null, 
  codigo    varchar(100) not null, 
  nombre    varchar(100) not null, 
  activo    BOOLEAN default TRUE not null, 
  primary key (motivo_id));
create table catalogo_parentesco (
  parentesco_id serial not null, 
  codigo        varchar(20) not null unique, 
  nombre        varchar(50) not null, 
  primary key (parentesco_id));
create table catalogo_prioridad (
  prioridad_id serial not null, 
  codigo       varchar(20) not null unique, 
  nombre       varchar(30) not null, 
  color_hex    varchar(7), 
  orden        INT default 0 not null, 
  primary key (prioridad_id));
create table catalogo_tipo_atencion (
  tipo_atencion_id serial not null, 
  codigo           varchar(50) not null unique, 
  nombre           varchar(200) not null, 
  tipo_grupo_id    INT not null, 
  activo           BOOLEAN default TRUE not null, 
  primary key (tipo_atencion_id));
create table catalogo_tipo_grupo (
  tipo_grupo_id serial not null, 
  codigo        varchar(20) not null unique, 
  nombre        varchar(50) not null, 
  primary key (tipo_grupo_id));
create table especialidad (
  especialidad_id serial not null, 
  codigo          varchar(20) not null unique, 
  nombre          varchar(50) not null, 
  primary key (especialidad_id));
create table estado_incidente_evento (
  evento_id            UUID default gen_random_uuid() not null,
  incidente_id         UUID not null,
  fecha                timestamp default now() not null,
  motivo               varchar(200),
  nota                 text,
  estado_resultante_id INT not null,
  equipo_id            INT,
  catalogo_motivo_id   INT,
  usuario_id           UUID,
  area_id              INT,
  primary key (evento_id));
create table incidente (
  incidente_id      UUID default gen_random_uuid() not null,
  codigo            varchar(20) not null unique,
  suministro_codigo varchar(20) not null,
  direccion         varchar(300),
  distrito          varchar(50) not null,
  tipo_atencion_id  INT not null,
  creado_en         timestamp default now() not null,
  latitud           numeric(10, 7),
  longitud          numeric(10, 7),
  primary key (incidente_id));
create table incidente_alerta_regla (
  incidente_alerta_regla_id      uuid default gen_random_uuid() not null,
  incidenteincidente_id          UUID not null,
  alerta_reglaalerta_regla_id    INT not null,
  catalogo_prioridadprioridad_id INT,
  fecha                          timestamp not null,
  descripcion                    text not null,
  primary key (incidente_alerta_regla_id));
create table permiso (
  permiso_id serial not null, 
  codigo     varchar(50) not null unique, 
  nombre     varchar(100) not null, 
  modulo     varchar(30), 
  primary key (permiso_id));
create table reclamo (
  reclamo_id          UUID default gen_random_uuid() not null, 
  ticket_original     varchar(20) not null unique, 
  incidente_id        UUID not null, 
  dni                 varchar(15), 
  persona             varchar(200) not null, 
  celular             varchar(20), 
  telefono_fijo       varchar(20), 
  correo              varchar(150), 
  parentesco_id       INT not null, 
  direccion_detalle   text, 
  distrito            varchar(50) not null, 
  alcance_id          INT not null, 
  medio_recepcion_id  INT not null, 
  detalle_del_ticket  text, 
  problema            text, 
  es_robo             BOOLEAN default FALSE not null, 
  tecnico_nombre      varchar(150), 
  fecha_registro      timestamp not null, 
  usuario_registra_id UUID, 
  creado_en           timestamp default now() not null, 
  primary key (reclamo_id));
create table rol (
  rol_id      serial not null, 
  codigo      varchar(30) not null unique, 
  nombre      varchar(50) not null, 
  descripcion text, 
  activo      BOOLEAN default TRUE not null, 
  primary key (rol_id));
create table rol_permiso (
  rol_id     INT not null, 
  permiso_id INT not null, 
  primary key (rol_id, 
  permiso_id));
create table sync_log (
  sync_id           UUID default gen_random_uuid() not null, 
  usuario_id        UUID not null, 
  tabla_afectada    varchar(50) not null, 
  operacion         varchar(10) not null, 
  registro_id       UUID not null, 
  payload           JSONB not null, 
  creado_en_cliente timestamp not null, 
  sincronizado_en   timestamp, 
  estado            varchar(20) default 'PENDIENTE' not null, 
  conflicto_detalle text, 
  primary key (sync_id), 
  constraint chk_sync_estado 
    check (estado    IN ('PENDIENTE','OK','CONFLICTO')), 
  constraint chk_sync_op 
    check (operacion IN ('INSERT','UPDATE','DELETE')));
create table tipo_alerta (
  id          serial not null, 
  codigo      varchar(150) not null, 
  nombre      varchar(150) not null, 
  descripcion text not null, 
  alcance     varchar(100) not null, 
  primary key (id));
create table usuario (
  usuario_id    UUID default gen_random_uuid() not null, 
  dni           varchar(15) not null unique, 
  username      varchar(50) not null unique, 
  nombres       varchar(100) not null, 
  apellidos     varchar(100) not null, 
  email         varchar(150) unique, 
  telefono      varchar(20), 
  password_hash varchar(255) not null, 
  rol_id        INT not null, 
  area_id       INT, 
  activo        BOOLEAN default TRUE not null, 
  ultimo_login  timestamp, 
  creado_en     timestamp default now() not null, 
  avatarUrl     varchar(255), 
  primary key (usuario_id));
create table usuario_especialidad (
  usuario_id      UUID not null, 
  especialidad_id INT not null, 
  primary key (usuario_id, 
  especialidad_id));
create index idx_evt_incidente 
  on estado_incidente_evento (incidente_id);
create index idx_evt_fecha 
  on estado_incidente_evento (fecha);
create index idx_inc_suministro
  on incidente (suministro_codigo);
create index idx_inc_creado
  on incidente (creado_en);
create index idx_inc_bbox
  on incidente (latitud, longitud);
create index idx_rec_incidente 
  on reclamo (incidente_id);
create index idx_rec_fecha 
  on reclamo (fecha_registro);
create index idx_rec_dni 
  on reclamo (dni);
create index idx_sync_estado 
  on sync_log (estado);
create index idx_sync_usuario 
  on sync_log (usuario_id);
alter table estado_incidente_evento add constraint FKestado_inc70457 foreign key (usuario_id) references usuario (usuario_id);
alter table estado_incidente_evento add constraint FKestado_inc652189 foreign key (catalogo_motivo_id) references catalogo_motivo (motivo_id);
alter table estado_incidente_evento add constraint FKestado_inc278550 foreign key (equipo_id) references catalogo_equipo (equipo_id);
alter table estado_incidente_evento add constraint fk_evt_area foreign key (area_id) references area (area_id);
alter table incidente_alerta_regla add constraint FKincidente_504581 foreign key (catalogo_prioridadprioridad_id) references catalogo_prioridad (prioridad_id);
alter table incidente_alerta_regla add constraint FKincidente_323188 foreign key (alerta_reglaalerta_regla_id) references alerta_regla (alerta_regla_id);
alter table incidente_alerta_regla add constraint FKincidente_19638 foreign key (incidenteincidente_id) references incidente (incidente_id);
alter table alerta_regla add constraint FKalerta_reg556103 foreign key (tipo_alertaid) references tipo_alerta (id);
alter table estado_incidente_evento add constraint fk_evt_estado_res foreign key (estado_resultante_id) references catalogo_estado (estado_id);
alter table estado_incidente_evento add constraint fk_evt_incidente foreign key (incidente_id) references incidente (incidente_id);
alter table incidente add constraint fk_inc_tipo_atencion foreign key (tipo_atencion_id) references catalogo_tipo_atencion (tipo_atencion_id);
alter table reclamo add constraint fk_rec_alcance foreign key (alcance_id) references catalogo_alcance (alcance_id);
alter table reclamo add constraint fk_rec_incidente foreign key (incidente_id) references incidente (incidente_id);
alter table reclamo add constraint fk_rec_medio foreign key (medio_recepcion_id) references catalogo_medio_recepcion (medio_recepcion_id);
alter table reclamo add constraint fk_rec_parentesco foreign key (parentesco_id) references catalogo_parentesco (parentesco_id);
alter table reclamo add constraint fk_rec_usuario foreign key (usuario_registra_id) references usuario (usuario_id);
alter table rol_permiso add constraint fk_rp_permiso foreign key (permiso_id) references permiso (permiso_id);
alter table rol_permiso add constraint fk_rp_rol foreign key (rol_id) references rol (rol_id);
alter table sync_log add constraint fk_sync_usuario foreign key (usuario_id) references usuario (usuario_id);
alter table catalogo_tipo_atencion add constraint fk_tipoat_grupo foreign key (tipo_grupo_id) references catalogo_tipo_grupo (tipo_grupo_id);
alter table usuario_especialidad add constraint fk_ue_especialidad foreign key (especialidad_id) references especialidad (especialidad_id);
alter table usuario_especialidad add constraint fk_ue_usuario foreign key (usuario_id) references usuario (usuario_id);
alter table usuario add constraint fk_usuario_area foreign key (area_id) references area (area_id);
alter table usuario add constraint fk_usuario_rol foreign key (rol_id) references rol (rol_id);

