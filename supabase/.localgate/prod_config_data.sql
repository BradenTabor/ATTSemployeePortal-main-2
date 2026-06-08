-- Source: prod HEAD 20260608021312
-- Capture date: 2026-06-08
-- Regenerated only at a deliberate re-baseline — see docs/CONVENTIONS.md (re-baseline runbook).
--
-- PostgreSQL database dump
--

\restrict SykadTWzK2gbricZqftMODK3difyM69skelwSYpdHC7Jz1ebRD9Y0a5RABIOF0u

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

\unrestrict SykadTWzK2gbricZqftMODK3difyM69skelwSYpdHC7Jz1ebRD9Y0a5RABIOF0u

