-- Source: prod HEAD 20260608181348
-- Capture date: 2026-06-08
-- Regenerated only at a deliberate re-baseline — see docs/CONVENTIONS.md (re-baseline runbook).
--
-- PostgreSQL database dump
--

\restrict lV1aoxTxdpDauJmAbp1OlQgdQWordc7y2dRdwybq2AKz9R8qcMsl6S2sgt9es8w

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badges (badge_key, category, title, description, condition_spec, prestige_max, is_feed_worthy, is_active, sort_order, created_at) FROM stdin;
first_light	onboarding	First Light	Opened My Progress for the first time.	{"type": "first_visit"}	1	f	t	10	2026-06-08 15:54:33.329219+00
on_the_board	progression	On the Board	Reached your first major tier beyond Seedling.	{"type": "tier_promotion", "min_tier_order": 2}	1	f	t	20	2026-06-08 15:54:33.329219+00
sharp_eye	safety	Sharp Eye	Filed near-miss reports that led to verified corrective action.	{"type": "near_miss_actionable", "signal": "corrective_bonus"}	3	t	t	30	2026-06-08 15:54:33.329219+00
certified	safety	Certified	Earned your first active certification.	{"type": "cert_active", "min_distinct_types": 1}	1	t	t	40	2026-06-08 15:54:33.329219+00
stacked	safety	Stacked	Holds multiple active certification types.	{"type": "cert_active", "min_distinct_types": 3}	3	t	t	50	2026-06-08 15:54:33.329219+00
cashed_in	redemption	Cashed In	Redeemed reward points for the first time.	{"type": "redemption_created", "min_count": 1}	1	f	t	60	2026-06-08 15:54:33.329219+00
lit	engagement	Lit	Maintained a weekly meaningful-action streak.	{"type": "streak_weeks", "signal": "streak_state"}	3	t	t	70	2026-06-08 15:54:33.329219+00
one_ring	tenure	One Ring	One year with ATTS.	{"type": "tenure_years", "min_years": 1}	1	t	t	80	2026-06-08 15:54:33.329219+00
five_rings	tenure	Five Rings	Five years with ATTS.	{"type": "tenure_years", "min_years": 5}	1	t	t	90	2026-06-08 15:54:33.329219+00
old_timber	tenure	Old Timber	Ten years with ATTS.	{"type": "tenure_years", "min_years": 10}	1	t	t	100	2026-06-08 15:54:33.329219+00
\.


--
-- Data for Name: gamification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gamification_settings (key, value, description, updated_at, updated_by) FROM stdin;
program_owner_user_id	null	Primary gamification program owner (stub Phase 1)	2026-06-08 15:48:19.595828+00	\N
program_backup_user_id	null	Backup owner (stub Phase 1)	2026-06-08 15:48:19.595828+00	\N
streak_freezes_per_user	1	Manual streak freezes granted per user	2026-06-08 15:48:19.595828+00	\N
streak_milestone_weeks	[4, 12, 26]	Lit badge week thresholds (B/S/G)	2026-06-08 15:48:19.595828+00	\N
sharp_eye_prestige_counts	[3, 10, 25]	Sharp Eye B/S/G — actionable near-miss counts	2026-06-08 15:48:19.595828+00	\N
cert_stacked_prestige_counts	[3, 5, 10]	Stacked badge B/S/G — distinct active certification types	2026-06-08 15:48:19.595828+00	\N
competition_eligible_roles	["employee", "foreman", "general_foreman", "mechanic"]	Field roles eligible for standings	2026-06-08 15:48:19.595828+00	\N
feed_worthy_tier_promotions	["major_tier_only"]	Recognition feed emits major tier promotions only	2026-06-08 15:48:19.595828+00	\N
\.


--
-- Data for Name: level_tiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.level_tiers (id, tier_key, tier_name, tier_order, sub_level, sub_level_label, entry_threshold, is_active, created_at) FROM stdin;
db0c694b-3d29-42d0-bcf1-2cf4e8b591a4	seedling	Seedling	1	1	I	0	t	2026-06-08 15:48:19.595828+00
de0f313d-959a-4109-af97-2018aeee64cd	seedling	Seedling	1	2	II	20	t	2026-06-08 15:48:19.595828+00
e9e20df7-dd36-4749-ac10-bc887238b5da	seedling	Seedling	1	3	III	35	t	2026-06-08 15:48:19.595828+00
830cdd98-e375-48e5-8313-ed834372e0e0	sapling	Sapling	2	1	I	50	t	2026-06-08 15:48:19.595828+00
480f331a-cf85-4ac0-a3a0-fa1d1cbcc925	sapling	Sapling	2	2	II	85	t	2026-06-08 15:48:19.595828+00
81773ced-1573-4cbb-a8c0-57c1b6e17997	sapling	Sapling	2	3	III	120	t	2026-06-08 15:48:19.595828+00
baa2c907-ac4a-4860-8f6a-9d459c9e6f92	rooted	Rooted	3	1	I	150	t	2026-06-08 15:48:19.595828+00
60b53873-a504-43e8-97b9-f6a66ded80e3	rooted	Rooted	3	2	II	230	t	2026-06-08 15:48:19.595828+00
e668d27e-4e06-4082-a961-9ad8891fde08	rooted	Rooted	3	3	III	310	t	2026-06-08 15:48:19.595828+00
6492f6db-c14e-47e1-9efe-ae3e8b645822	mature	Mature	4	1	I	400	t	2026-06-08 15:48:19.595828+00
5424c574-47ad-4d11-ab3f-6083cd13a33d	mature	Mature	4	2	II	565	t	2026-06-08 15:48:19.595828+00
ccc81d9c-fc50-4551-bb41-b14c817181d4	mature	Mature	4	3	III	730	t	2026-06-08 15:48:19.595828+00
0ef89831-aa56-4ff5-ab8e-bc3ad5c39969	towering	Towering	5	1	I	900	t	2026-06-08 15:48:19.595828+00
3011cac3-d02e-49f3-8f40-30aa86b906a9	towering	Towering	5	2	II	1200	t	2026-06-08 15:48:19.595828+00
1ea49a35-6c12-445a-8039-adcf4304e530	towering	Towering	5	3	III	1500	t	2026-06-08 15:48:19.595828+00
9a8b654f-80e5-4c74-8d60-e73d1575c5c9	canopy	Canopy	6	1	I	1800	t	2026-06-08 15:48:19.595828+00
50c321ae-52d4-4d58-9feb-f2b8049850c4	canopy	Canopy	6	2	II	2350	t	2026-06-08 15:48:19.595828+00
8c17a999-d71e-460b-91bb-b2cd630a8148	canopy	Canopy	6	3	III	2900	t	2026-06-08 15:48:19.595828+00
7796195e-4372-4324-b474-a89a093f0136	old_growth	Old Growth	7	1	I	3500	t	2026-06-08 15:48:19.595828+00
5d8a3479-1111-458e-bf4d-094955a2e441	old_growth	Old Growth	7	2	II	4650	t	2026-06-08 15:48:19.595828+00
11164139-6cdb-47ba-a12c-6cbc27d87c72	old_growth	Old Growth	7	3	III	5800	t	2026-06-08 15:48:19.595828+00
8563da55-e1b4-41a9-9845-982baf67cb28	redwood	Redwood	8	1	I	7000	t	2026-06-08 15:48:19.595828+00
1de1d86e-1361-4b1f-af00-ff88292cf1d2	redwood	Redwood	8	2	II	9000	t	2026-06-08 15:48:19.595828+00
40664769-f303-4695-aebb-1c2d0abe8549	redwood	Redwood	8	3	III	11000	t	2026-06-08 15:48:19.595828+00
\.


--
-- Data for Name: point_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_rules (id, source, rule_key, points, is_active, description, created_at, updated_at) FROM stdin;
e8b77f48-5a43-4f0f-9d76-e1a73557f75f	near_miss_report	base_amount	10	t	Points per near-miss incident filed (category=base)	2026-06-06 02:38:24.393331+00	2026-06-06 02:38:24.393331+00
631c1fc8-870f-4f69-a444-9c8074885575	near_miss_report	base_daily_cap	2	t	Max base near-miss awards per reporter per calendar day (America/Chicago)	2026-06-06 02:38:24.393331+00	2026-06-06 02:38:24.393331+00
18a6d8e4-2b0d-4c70-83ad-0fcca3f0de53	near_miss_report	corrective_bonus_amount	15	t	One-time bonus when a near-miss CAPA reaches verified (category=corrective_bonus)	2026-06-06 02:38:24.393331+00	2026-06-06 02:38:24.393331+00
bd42444f-8c9b-4e37-868e-632b6fa963f5	certification	pass_amount	20	t	Points when a certification record becomes active (category=pass)	2026-06-06 02:38:24.393331+00	2026-06-06 02:38:24.393331+00
512eacb2-e300-47c3-a654-126b1f23f3a9	certification	early_renewal_amount	10	t	Bonus for early renewal while cert still active and unexpired (category=early_renewal)	2026-06-06 02:38:24.393331+00	2026-06-06 02:38:24.393331+00
\.


--
-- Data for Name: reward_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reward_catalog (id, name, description, image_url, point_cost, stock_qty, category, is_active, sort_order, created_by, created_at, updated_at) FROM stdin;
a1000001-0000-4000-8000-000000000002	Water Bottle	Insulated ATTS water bottle	\N	60	\N	gear	t	20	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000003	ATTS Tee	Branded ATTS t-shirt	\N	100	\N	apparel	t	30	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000004	Work Gloves	Heavy-duty work gloves	\N	125	\N	gear	t	40	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000005	$25 Gift Card	$25 gift card	\N	250	\N	gift_card	t	50	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000006	ATTS Hoodie	Branded ATTS hoodie	\N	400	12	apparel	t	60	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000007	$50 Gift Card	$50 gift card	\N	500	\N	gift_card	t	70	\N	2026-06-06 03:33:50.896805+00	2026-06-06 03:33:50.896805+00
a1000001-0000-4000-8000-000000000001	ATTS Cap	Branded ATTS cap	https://emqqxfzahmwnehxcpxzp.supabase.co/storage/v1/object/public/safety-rewards/catalog/a1000001-0000-4000-8000-000000000001/1780718930412.jpg	75	\N	apparel	t	10	\N	2026-06-06 03:33:50.896805+00	2026-06-06 04:08:53.106+00
\.


--
-- PostgreSQL database dump complete
--

\unrestrict lV1aoxTxdpDauJmAbp1OlQgdQWordc7y2dRdwybq2AKz9R8qcMsl6S2sgt9es8w

