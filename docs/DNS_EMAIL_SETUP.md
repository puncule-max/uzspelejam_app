# uzspelejam.lv — DNS un e-pastu konfigurācija

Stāvoklis 2026-10-06: visi pieci DNS ieraksti saglabāti NIC panelī un pārbaudīti lietotāja ekrānattēlā. Resend rāda `Verified` domēnam `uzspelejam.lv`. Supabase custom SMTP saglabāts un pēc konfigurācijas ielādes pārbaudīts. Lietotāja apstiprināja reālu paroles atjaunošanu un atkārtotu pierakstīšanos ar jauno paroli gan esošajā Vercel adresē, gan `uzspelejam.lv`. Jaunais domēns atver aplikāciju ar HTTPS (HTTP 200). Vercel `NEXT_PUBLIC_SITE_URL` un Supabase Site URL pārslēgti uz `https://uzspelejam.lv`; jaunā domēna callback atļaujas pievienotas, vecās saglabātas pārejas laikam. Pagaidu e-pasta testa konts un sesijas sakoptas. Jauna pastāvīgā konta reģistrācija caur Resend vēl ir atsevišķi jāpārbauda. Zemāk ir konkrētajam projektam panelī nolasītās vērtības, nevis dokumentācijas piemēri.

## DNS ieraksti NIC panelim

Saglabā pašreizējo DNS pārvaldnieku. Nav nepieciešams mainīt domēna nameserverus tikai šo ierakstu dēļ.

| Tips | Nosaukums pilnā formā | Vērtība | Nolūks |
| --- | --- | --- | --- |
| A | uzspelejam.lv | 216.198.79.1 | Vercel aplikācija |
| TXT | resend._domainkey.uzspelejam.lv | Skatīt DKIM vērtību zem tabulas | E-pasta paraksta pārbaude |
| CNAME | rsend.uzspelejam.lv | rsend-euw1.forge.rmta.net | Resend sūtīšana Īrijas reģionā |
| CNAME | send.uzspelejam.lv | send.forge.rmta.net | Resend sūtīšanas apakšdomēns |
| TXT | _dmarc.uzspelejam.lv | v=DMARC1; p=none; | Sākotnējā DMARC politika |

TTL: NIC noklusējuma vērtība. Šajā NIC formā Hostname/Alias laukos ievadīti tabulā redzamie pilnie domēna nosaukumi; A ierakstam izmantots `uzspelejam.lv`, nevis `@`.

DKIM TXT vērtība — kopē visu vienā rindā:

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCoRhqK9hHuZHhlkPRhjvFh+rBGopk44h6lvwn8bAfbV7VVgmtX9omxsbDPUrrhv2RYVILbQaXOw77uoqvuKy7C0AaYmGCwAl9C9roKqailHYNEerRkXTt/Qza0ZEQASWkIXB4PHAaI4G8NcVcE4KHXF4WQ1hAl6Ykj6Kk9ydzJfQIDAQAB
```

Šī DKIM vērtība ir publiska DNS atslēga, nevis Resend API atslēga. API atslēgas un SMTP paroles nedrīkst ievietot šajā failā vai Git.

## Resend reģions

Saglabāts Ireland (`eu-west-1`). Tas nosaka e-pastu sūtīšanas serveru reģionu, nevis aplikācijas darbības valsti. Reģiona izvēle pati par sevi nenozīmē, ka visi Resend konta dati glabājas ES: pakalpojuma dokumentācijā konta metadatu, žurnālu un API ierakstu glabāšana norādīta ASV.

## Pēc DNS ievades

Pabeigts: DNS ievade, Resend domēna verifikācija un Supabase SMTP pieslēgums. Aktīvajai API atslēgai `Uzspelejam Supabase SMTP` piešķirta `Sending access` tikai domēnam `uzspelejam.lv`. Sākotnējā neizmantotā atslēga atsaukta; atstāta viena aktīva atslēga. Slepenā vērtība nav saglabāta repozitorijā.

SMTP iestatījumi: `smtp.resend.com:465`, lietotājs `resend`, sūtītājs `Uzspēlējam? <no-reply@uzspelejam.lv>`, minimālais intervāls vienam lietotājam 60 sekundes. Paroles atjaunošanas e-pasta piegāde un atkārtota pierakstīšanās pārbaudīta ar lietotāju. Pēc lapas pārlādes jāsagaida konfigurācijas ielāde: sākotnējais izslēgtais slēdzis pats par sevi nepierāda, ka saglabāšana neizdevās.

1. Pārbaudi publisko DNS un Vercel domēna statusu/certifikātu.
2. Resend domēna lapā izvēlies `I've added the records` un sagaidi verifikāciju. E-pastu saņemšanas funkcija nav ieslēgta; šī konfigurācija paredzēta aplikācijas sūtījumiem.
3. Pēc verifikācijas sagatavo sūtīšanai paredzētu API atslēgu ar iespējami šauru domēna piekļuvi. Atslēgas izveide un nodošana Supabase jāveic droši, nepublicējot to sarunā vai Git.
4. Supabase SMTP: host `smtp.resend.com`, ports `465`, lietotājvārds `resend`, parole — Resend API atslēga. Sūtītāja nosaukums `Uzspēlējam?`, adrese `no-reply@uzspelejam.lv`.
5. Izslēdz saišu/atvēršanas izsekošanu autentifikācijas e-pastiem; pārbaudi Auth e-pastu limitus un verifikācijas/paroles atjaunošanas veidnes.
6. Tikai pēc veiksmīgas HTTPS pārbaudes pārslēdz produkcijas pamata adresi un Supabase callback konfigurāciju uz `https://uzspelejam.lv`. Pārejas laikā saglabā esošās Vercel adreses darbību.
7. Pārbaudi reģistrācijas apstiprinājumu un pilnu paroles atjaunošanu, pēc tam sakop autorizētos testa datus.

## Avoti

- Vercel konkrētā projekta Domains panelis: https://vercel.com/puncule-8500/uzspelejam-app-prod/settings/domains
- Resend konkrētā domēna ieraksti: https://resend.com/domains/add/f3cb9f63-db2a-4a10-82e7-4c02cf7b5723
- SMTP integrācija: https://resend.com/docs/send-with-supabase-smtp
- Reģioni: https://resend.com/docs/dashboard/domains/regions
