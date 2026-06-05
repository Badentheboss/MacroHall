create table if not exists schools (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  listing_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dining_halls (
  id bigint generated always as identity primary key,
  school_id bigint not null references schools(id) on delete cascade,
  slug text not null,
  name text not null,
  source_url text,
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, slug)
);

create table if not exists menu_items (
  id bigint generated always as identity primary key,
  hall_id bigint not null references dining_halls(id) on delete cascade,
  name text not null,
  subheader text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hall_id, name, subheader)
);

create table if not exists menu_item_meals (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  meal text not null,
  unique (menu_item_id, meal)
);

create table if not exists menu_item_allergens (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  allergen text not null,
  unique (menu_item_id, allergen)
);

create table if not exists menu_item_traits (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  trait text not null,
  unique (menu_item_id, trait)
);

create table if not exists menu_item_nutrition (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  nutrient_key text not null,
  nutrient_value text not null,
  unique (menu_item_id, nutrient_key)
);

create index if not exists idx_dining_halls_school_id on dining_halls(school_id);
create index if not exists idx_menu_items_hall_id on menu_items(hall_id);
create index if not exists idx_menu_item_meals_menu_item_id on menu_item_meals(menu_item_id);
create index if not exists idx_menu_item_allergens_menu_item_id on menu_item_allergens(menu_item_id);
create index if not exists idx_menu_item_traits_menu_item_id on menu_item_traits(menu_item_id);
create index if not exists idx_menu_item_nutrition_menu_item_id on menu_item_nutrition(menu_item_id);
