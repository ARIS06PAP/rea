# Aedes albopictus: οι περιβαλλοντικές τιμές της εφαρμογής και οι πηγές τους

Έλεγχος: 8 Νοεμβρίου 2026. Τα ίδια στοιχεία σε μορφή για κώδικα (στα αγγλικά): `science_values.json`.

Ελέγχθηκαν οι 13 τιμές που χρησιμοποιεί η εφαρμογή για το ασιατικό κουνούπι τίγρη (Aedes albopictus), η καθεμία στην πρωτογενή δημοσίευση (PubMed, PMC, σελίδες εκδοτών). Ως προαιρετικό πλαίσιο για τη συνάρτηση θερμοκρασίας προστέθηκαν τα θερμικά όρια του Mordecai et al. 2017 (#14 και #15). Όλα αφορούν την οικολογία του είδους (περιβαλλοντικές συνθήκες), όχι παθογόνα.

**Κατηγορίες** (ίδιες ετικέτες με το JSON)
- `laboratory`: μέτρηση σε εργαστήριο, συνήθως σε σταθερή θερμοκρασία.
- `field observation`: παρατήρηση στο πεδίο (παγίδες).
- `statistical/mechanistic model result`: ο αριθμός βγαίνει από στατιστικό ή μηχανιστικό μοντέλο, συχνά πάνω σε δεδομένα πεδίου.
- `proposed climatic suitability threshold`: όριο που προτάθηκε για χάρτες κλιματικής καταλληλότητας, από την κατανομή του είδους ή από κρίση ειδικών.

**Επαλήθευση:** «ναι» = αριθμός και πλαίσιο συμφωνούν με την πηγή· «μερική» = διαφέρει ο αριθμός ή το πλαίσιο· «όχι» = δεν βρέθηκε πρωτογενής πηγή. Καμία από τις 13 τιμές δεν βγήκε «όχι».

**Προσοχή:** καμία τιμή του πίνακα δεν είναι όριο επιβίωσης ή θανάτου. Είναι όρια για χάρτες, κορυφές καμπυλών ή συνθήκες εργαστηρίου. Το μόνο πραγματικό όριο επιβίωσης που αναφέρεται εδώ είναι εργαστηριακό: αυγά σε διάπαυση άντεξαν −10 °C (Thomas et al. 2012, στο #4).

## Συνοπτικός πίνακας

| # | Παράμετρος | Τιμή όπως επιβεβαιώθηκε | Κατηγορία | Επαλήθευση | Κύρια πηγή |
|---|---|---|---|---|---|
| 1 | Θερμοκρασία | 25–30 °C: βέλτιστος ρυθμός αύξησης πληθυσμού (r) στο εργαστήριο· βέλτιστο ανάπτυξης 29,7 °C, κατώφλι ανάπτυξης 10,4 °C | laboratory | μερική | Delatte et al. 2009 |
| 2 | Θερμοκρασία | Κορυφή τσιμπημάτων 26,5 °C (95% CrI 25,3–28,1)· 16,4–37,1 °C = εύρος όπου η πρόβλεψη δίνει ≥ 1 θηλυκό ανά άτομο ανά ώρα | statistical/mechanistic model result | ναι | Yin et al. 2019 |
| 3 | Θερμοκρασία | Ελάχιστη θερμοκρασία 9 °C: τέλος της εποχής δραστηριότητας των ενηλίκων (φθινόπωρο)· έναρξη την άνοιξη πάνω από 13 °C | field observation | μερική | Roiz et al. 2010 |
| 4 | Θερμοκρασία | Μέση θερμοκρασία Ιανουαρίου > 0 °C: όριο για τη διαχείμαση των αυγών | proposed climatic suitability threshold | ναι | Roiz et al. 2011 |
| 5 | Θερμοκρασία | Μέση ετήσια θερμοκρασία > 11 °C | proposed climatic suitability threshold | ναι | Kobayashi et al. 2002 |
| 6 | Βροχόπτωση | ≥ 500 mm/έτος | proposed climatic suitability threshold | ναι | Knudsen et al. 1996 |
| 7 | Βροχόπτωση | 90–800 mm σε 35 ημέρες: ευνοϊκό εύρος για τις προνύμφες | statistical/mechanistic model result | ναι | Tran et al. 2020 |
| 8 | Βροχόπτωση | > 800 mm σε 35 ημέρες: λίγες προνύμφες (≤ 20 ανά παγίδα στην πρόβλεψη) | statistical/mechanistic model result | ναι | Tran et al. 2020 |
| 9 | Υγρασία | ~75–80% RH: συνθήκη εκτροφής στο εργαστήριο (75 ± 2% και 80 ± 3%) | laboratory | ναι | Marini et al. 2020· Damiens et al. 2019 |
| 10 | Υγρασία | Απόλυτη υγρασία > 10 g/m³: αυξημένη πιθανότητα παρουσίας | statistical/mechanistic model result | ναι | Dickens et al. 2018 |
| 11 | Άνεμος | > 4,3 m/s (μέσος όρος 5 εβδομάδων): αρνητική σχέση με την αφθονία· το «4 m/s» δεν βρέθηκε στην πηγή του | statistical/mechanistic model result | μερική | Bartholomée et al. 2025 |
| 12 | Βλάστηση | Χαμηλή βλάστηση (< 3 m) σε ακτίνα 250 m: θετική σχέση με την αφθονία | statistical/mechanistic model result | ναι | Bartholomée et al. 2025 |
| 13 | Βλάστηση | 10–23% χαμηλή βλάστηση σε 250 m: θετική επίδραση· πάνω από 23% καμία επιπλέον | statistical/mechanistic model result | ναι | Bartholomée et al. 2025 |
| 14 | Θερμοκρασία (πλαίσιο) | R0 μετάδοσης: κορυφή 26,4 °C, μηδέν κάτω από 16,2 °C και πάνω από 31,6 °C | statistical/mechanistic model result | ναι | Mordecai et al. 2017 |
| 15 | Θερμοκρασία (πλαίσιο) | Θερμικά όρια χαρακτηριστικών του κουνουπιού (T0/Tm), π.χ. διάρκεια ζωής ενηλίκου 13,4 / 31,5 °C | statistical/mechanistic model result | ναι | Mordecai et al. 2017, S2 Text |

## Λεπτομέρειες ανά τιμή

### 1. Θερμοκρασία: 25–30 °C
- **Τιμή:** 25–30 °C είναι το εύρος όπου ο εγγενής ρυθμός αύξησης του πληθυσμού (r) ήταν βέλτιστος. Τα ανώριμα στάδια αναπτύχθηκαν ταχύτερα στους 30 °C (8,8 ημέρες)· βέλτιστο ανάπτυξης 29,7 °C, κατώφλι ανάπτυξης 10,4 °C.
- **Κατηγορία:** laboratory
- **Πλαίσιο:** πληθυσμός F2 από τη Ρεϊνιόν (τροπική προέλευση), οκτώ σταθερές θερμοκρασίες από 5 έως 40 °C.
- **Απόσπασμα:** "optimum intrinsic rate of growth (r) was observed between 25 and 30 degrees C"
- **Πηγή:** Delatte H, Gimonneau G, Triboire A, Fontenille D. Influence of temperature on immature development, survival, longevity, fecundity, and gonotrophic cycles of Aedes albopictus, vector of chikungunya and dengue in the Indian Ocean. J Med Entomol. 2009;46(1):33–41. DOI [10.1603/033.046.0105](https://doi.org/10.1603/033.046.0105) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/19198515/)
- **Επαλήθευση:** μερική. Ο αριθμός υπάρχει, αλλά αφορά τον ρυθμό αύξησης του πληθυσμού (ανάπτυξη, επιβίωση και γονιμότητα μαζί), όχι μόνο την ανάπτυξη. Προτεινόμενη διατύπωση: «25–30 °C: βέλτιστο εύρος για την αύξηση του πληθυσμού στο εργαστήριο».
- **Σημειώσεις:** Σε εύκρατο πληθυσμό (Τρέντο, βόρεια Ιταλία) η μακροβιότητα και η γονιμότητα των ενηλίκων ήταν σαφώς μεγαλύτερες στους 25 °C· οι προνύμφες αναπτύχθηκαν ακόμη και στους 10 και 15 °C, αλλά εκεί δεν παρατηρήθηκε αιματοφαγία (Marini et al. 2020, DOI [10.3390/insects11110808](https://doi.org/10.3390/insects11110808)). Το πλήρες κείμενο του Delatte είναι πίσω από paywall· οι τιμές είναι από την περίληψη.

### 2. Θερμοκρασία: 26,5 °C
- **Τιμή:** 26,5 °C (95% CrI 25,3–28,1) είναι η κορυφή της προβλεπόμενης ωριαίας πυκνότητας θηλυκών που αναζητούν ξενιστή. Το 16,4–37,1 °C είναι το εύρος όπου το μοντέλο προβλέπει τουλάχιστον 1 θηλυκό ανά άτομο ανά ώρα (για τα αρσενικά 21,7–37,1 °C).
- **Κατηγορία:** statistical/mechanistic model result (μοντέλο πάνω σε δεδομένα πεδίου)
- **Πλαίσιο:** Γκουανγκζού (υποτροπική Κίνα), αστικοί υπαίθριοι χώροι, 2016–2018· ωριαίες συλλογές με παγίδες ανθρώπινου δολώματος (human-baited double net traps) και μετρήσεις θερμοκρασίας, υγρασίας, φωτισμού και ανέμου στη θέση· Bayesian negative binomial regression.
- **Απόσπασμα:** "female biting was 16.4–37.1 °C, peaking at 26.5 °C (95% credible interval: 25.3–28.1)"
- **Πηγή:** Yin Q, Li L, Guo X, Wu R, Shi B, Wang Y, et al. A field-based modeling study on ecological characterization of hourly host-seeking behavior and its associated climatic variables in Aedes albopictus. Parasit Vectors. 2019;12:474. DOI [10.1186/s13071-019-3715-1](https://doi.org/10.1186/s13071-019-3715-1) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6791010/)
- **Επαλήθευση:** ναι, όλοι οι αριθμοί.
- **Σημειώσεις:** Το 16,4–37,1 °C δεν είναι όριο δραστηριότητας ή επιβίωσης. Είναι ωριαία σχέση με τη θερμοκρασία του αέρα, όχι κλιματικό όριο, και ο πληθυσμός είναι υποτροπικός. Στην ίδια μελέτη η πυκνότητα αυξανόταν με τη σχετική υγρασία και γενικά μειωνόταν με τον άνεμο.

### 3. Θερμοκρασία: κάτω από 9 °C
- **Τιμή:** ελάχιστη θερμοκρασία 9 °C = τέλος της εποχής δραστηριότητας των ενηλίκων το φθινόπωρο. Την άνοιξη τα θηλυκά εμφανίστηκαν όταν η ελάχιστη θερμοκρασία ξεπέρασε τους 13 °C.
- **Κατηγορία:** field observation
- **Πλαίσιο:** παγίδες BG-Sentinel, Απρίλιος–Νοέμβριος 2008, Άρκο και Ρίβα ντελ Γκάρντα (βόρεια Ιταλία). Μία περιοχή, μία χρονιά.
- **Απόσπασμα:** "end of adult activity was found at a minimum temperature of 9°C"
- **Πηγή:** Roiz D, Rosà R, Arnoldi D, Rizzoli A. Effects of temperature and rainfall on the activity and dynamics of host-seeking Aedes albopictus females in northern Italy. Vector Borne Zoonotic Dis. 2010;10(8):811–816. DOI [10.1089/vbz.2009.0098](https://doi.org/10.1089/vbz.2009.0098) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/20059318/)
- **Επαλήθευση:** μερική. Το 9 °C αφορά την ελάχιστη, όχι τη μέση θερμοκρασία, και σημαίνει τέλος της εποχής, όχι γενικά «έντονα μειωμένη δραστηριότητα». Προτεινόμενη διατύπωση: «ελάχιστη θερμοκρασία κάτω από ~9 °C: τέλος της περιόδου δραστηριότητας των ενηλίκων (πεδίο, βόρεια Ιταλία)».
- **Σημειώσεις:** Σχετική παράμετρος μοντέλου: στο Medlock et al. 2006, όπως το περιγράφει το Caminade et al. 2012, η φθινοπωρινή διάπαυση των αυγών αρχίζει στους 9,5 °C μαζί με φωτοπερίοδο 13,5 h και η ανοιξιάτικη εκκόλαψη στους 10,5 °C με 11,25 h. Το πλήρες κείμενο του Roiz 2010 δεν ήταν προσβάσιμο, οπότε δεν ελέγχθηκε σε ποια περίοδο υπολογίζεται η ελάχιστη θερμοκρασία.

### 4. Θερμοκρασία: Ιανουάριος πάνω από 0 °C
- **Τιμή:** μέση θερμοκρασία Ιανουαρίου πάνω από 0 °C, το ευρέως χρησιμοποιούμενο όριο για την επιβίωση των αυγών σε διάπαυση. Στο Τρεντίνο το όριο 0 °C σε θερμοκρασία επιφάνειας εδάφους (LST, MODIS), μαζί με τους 11 °C ετήσιας μέσης, ήταν ο καλύτερος προβλεπτής του πού ζει το είδος.
- **Κατηγορία:** proposed climatic suitability threshold
- **Πλαίσιο:** επαρχία Τρέντο (αλπικές κοιλάδες, βόρεια Ιταλία)· ovitraps (παρουσία/απουσία) και MODIS LST 2001–2009· διαλέχτηκαν τα όρια που ταίριαζαν καλύτερα στα δεδομένα πεδίου.
- **Απόσπασμα:** "An air temperature of 0°C is the generally accepted threshold for JanTmean"
- **Πηγή:** Roiz D, Neteler M, Castellani C, Arnoldi D, Rizzoli A. Climatic factors driving invasion of the tiger mosquito (Aedes albopictus) into new areas of Trentino, northern Italy. PLoS One. 2011;6(4):e14800. DOI [10.1371/journal.pone.0014800](https://doi.org/10.1371/journal.pone.0014800) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3078124/)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Η αρχική διατύπωση είναι στο Knudsen et al. 1996 (μέση μηνιαία θερμοκρασία χειμώνα 0 °C ως ένα από τα «καθιερωμένα κριτήρια»· [PubMed 8827590](https://pubmed.ncbi.nlm.nih.gov/8827590/), χωρίς DOI). Παραλλαγές: Kobayashi et al. 2002 (Ιαπωνία): −2 °C. Medlock et al. 2006 (μέσω Caminade et al. 2012): πολύ ακατάλληλο όταν ο Ιανουάριος είναι κάτω από 0 °C και η βροχή κάτω από 500 mm, απόλυτα κατάλληλο πάνω από 2 °C και 700 mm. Μοντέλο ECDC 2009 (μέσω Caminade): μηδενική καταλληλότητα κάτω από −1 °C, μέγιστη πάνω από 3 °C. Δεν είναι θανατηφόρο όριο: στο εργαστήριο αυγά ευρωπαϊκού στελέχους σε διάπαυση εκκολάφθηκαν μετά από −10 °C για 12–24 h, ενώ κανένα αυγό δεν εκκολάφθηκε μετά από −15 °C (Thomas et al. 2012, DOI [10.1186/1756-3305-5-100](https://doi.org/10.1186/1756-3305-5-100)). Το Roiz χρησιμοποίησε LST, όχι θερμοκρασία αέρα, αν και το θεωρεί ισοδύναμο με το όριο 0 °C του αέρα.

### 5. Θερμοκρασία: ετήσια μέση πάνω από 11 °C
- **Τιμή:** μέση ετήσια θερμοκρασία πάνω από 11 °C.
- **Κατηγορία:** proposed climatic suitability threshold
- **Πλαίσιο:** επιτήρηση προνυμφών σε 26 αστικές και αγροτικές περιοχές της Τοχόκου (βόρειο Χονσού, Ιαπωνία), 1998–2000, με κλιματολογική ανάλυση σε GIS· οι συνθήκες που εξηγούσαν το βόρειο όριο εξάπλωσης (38–40° Β).
- **Απόσπασμα:** "an annual mean temperature higher than 11 degrees C"
- **Πηγή:** Kobayashi M, Nihei N, Kurihara T. Analysis of northern distribution of Aedes albopictus (Diptera: Culicidae) in Japan by geographical information system. J Med Entomol. 2002;39(1):4–11. DOI [10.1603/0022-2585-39.1.4](https://doi.org/10.1603/0022-2585-39.1.4) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/11931270/)
- **Επαλήθευση:** ναι για Kobayashi και Roiz· το Medlock 2006 δεν ελέγχθηκε απευθείας (paywall).
- **Σημειώσεις:** Η ίδια μελέτη δίνει επίσης Ιανουάριο πάνω από −2 °C, περισσότερες από 186 ημέρες τον χρόνο πάνω από 11 °C και πάνω από 1.350 βαθμοημέρες με βάση τους 11 °C. Στο Roiz et al. 2011 το όριο 11 °C (σε LST), μαζί με 0 °C τον Ιανουάριο, έδωσε την καλύτερη πρόβλεψη. Το Caminade et al. 2012 (συν-συγγραφέας ο Medlock) χρησιμοποιεί ζώνες από τον Kobayashi: πάνω από 12 °C απόλυτα κατάλληλο, 11–12 °C υψηλό, 10–11 °C μέτριο, 9–10 °C χαμηλό. Όριο κατανομής, όχι όριο επιβίωσης.

### 6. Βροχόπτωση: 500 mm τον χρόνο
- **Τιμή:** τουλάχιστον 500 mm (50 cm) μέση ετήσια βροχόπτωση: κριτήριο ειδικών για τις περιοχές όπου μπορεί να εγκατασταθεί το είδος. Το Roiz et al. 2011 το συνδέει με τη διατήρηση των εστιών αναπαραγωγής (larval habitats).
- **Κατηγορία:** proposed climatic suitability threshold
- **Πλαίσιο:** προτάθηκε για την πρόβλεψη της εξάπλωσης στην Ευρώπη μετά την εισβολή στην Ιταλία, μαζί με χειμώνα 0 °C και καλοκαίρι περίπου 20 °C. Η ίδια εργασία κατατάσσει την Ελλάδα στις χώρες που πληρούν τα κριτήρια.
- **Απόσπασμα:** "where at least 50 cm of mean annual rainfall occurs"
- **Πηγή:** Knudsen AB, Romi R, Majori G. Occurrence and spread in Italy of Aedes albopictus, with implications for its introduction into other parts of Europe. J Am Mosq Control Assoc. 1996;12(2 Pt 1):177–183. Χωρίς DOI · [PubMed](https://pubmed.ncbi.nlm.nih.gov/8827590/)
- **Επαλήθευση:** ναι, ως προτεινόμενο κριτήριο.
- **Σημειώσεις:** Δεν προκύπτει από στατιστικό έλεγχο. Το Roiz et al. 2011 γράφει ότι το είδος βρίσκεται και σε περιοχές με λιγότερη βροχή και βάζει τη νότια Ελλάδα στις περιοχές όπου η βροχή ίσως περιορίζει. Το Mitchell 1995 (J Vector Ecol 20:44–58), που αναφέρεται κι αυτό ως πηγή του ορίου, δεν είναι online και δεν διαβάστηκε. Παραλλαγές (μέσω Caminade et al. 2012): Medlock 2006 πάνω από 700 mm απόλυτα κατάλληλο για διαχείμαση· ECDC 2009 μηδενική καταλληλότητα κάτω από 450 mm, μέγιστη πάνω από 800 mm. Στην Ελλάδα το είδος έχει εγκατασταθεί σε πολλές περιφερειακές ενότητες (Badieritakis et al. 2018) και η Αττική αναφέρεται στις περιοχές με πληθυσμούς του (Adeleke et al. 2022). Άρα το 500 mm δεν πρέπει να αποκλείει περιοχές, ειδικά πόλεις όπου το νερό των εστιών έρχεται από δοχεία και πότισμα.

### 7. Βροχόπτωση: 90–800 mm σε 35 ημέρες
- **Τιμή:** αθροιστική βροχή 90–800 mm τις τελευταίες 35 ημέρες = ευνοϊκές συνθήκες για τις προνύμφες L3–L4, μαζί με μέση ελάχιστη θερμοκρασία 42 ημερών πάνω από 21 °C.
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** Ρεϊνιόν (τροπικό νησί, Ινδικός Ωκεανός), πέντε θέσεις, 2012–2013· εμπειρικό μοντέλο Support Vector Regression που επιλέχθηκε ανάμεσα σε 531 κλιματικούς δείκτες· σύγκριση με μηχανιστικό μοντέλο.
- **Απόσπασμα:** "between 90 and 800 mm of rain accumulation over the last 35 days"
- **Πηγή:** Tran A, Mangeas M, Demarchi M, Roux E, Degenne P, Haramboure M, et al. Complementarity of empirical and process-based approaches to modelling mosquito population dynamics with Aedes albopictus as an example—Application to the development of an operational mapping tool of vector populations. PLoS One. 2020;15(1):e0227407. DOI [10.1371/journal.pone.0227407](https://doi.org/10.1371/journal.pone.0227407)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Το άρθρο γράφει ότι οι προνύμφες μειώνονται «beyond 90 mm or over 800 mm»· το διαβάζουμε ως «εκτός του εύρους 90–800 mm» (η διατύπωση για το κάτω όριο μοιάζει με λάθος). Μικρή μεταφερσιμότητα στην Ελλάδα: τροπικό νησί, με περιοχές που ξεπερνούν τα 4.000 mm τον χρόνο. Στο ξηρό ελληνικό καλοκαίρι το κάτω όριο των 90 mm σπάνια θα καλύπτεται, ενώ τότε τα κουνούπια αφθονούν· να μην εφαρμοστεί κατά γράμμα.

### 8. Βροχόπτωση: πάνω από 800 mm σε 35 ημέρες
- **Τιμή:** πάνω από 800 mm σε 35 ημέρες οι προβλεπόμενες προνύμφες δεν ξεπερνούν τις 20 ανά παγίδα, ακόμη και με ευνοϊκή θερμοκρασία. Οι συγγραφείς το αποδίδουν στο ξέπλυμα (flushing) αυγών, προνυμφών και νυμφών από τις εστίες που γεμίζουν με βρόχινο νερό.
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** το ίδιο μοντέλο με το #7.
- **Απόσπασμα:** "above 800 mm [...] the predicted number of larvae does not exceed 20"
- **Πηγή:** Tran et al. 2020 (όπως στο #7). DOI [10.1371/journal.pone.0227407](https://doi.org/10.1371/journal.pone.0227407)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Το ξέπλυμα είναι ερμηνεία των συγγραφέων, όχι μέτρηση. Τα 800 mm σε 35 ημέρες είναι ακραία τιμή για την Ελλάδα. Στην Ευρώπη τα ευρήματα για τη βροχή διαφωνούν: η βροχή των 1–4 εβδομάδων πριν από τη δειγματοληψία είχε αρνητική συσχέτιση με τα θηλυκά στη βόρεια Ιταλία (Roiz et al. 2010), ενώ η βροχή 6 εβδομάδες πριν είχε θετική σχέση στο Μονπελιέ (Bartholomée et al. 2025).

### 9. Υγρασία: 75–80% σχετική υγρασία
- **Τιμή:** περίπου 75–80% σχετική υγρασία είναι συνθήκη εκτροφής στο εργαστήριο: 80 ± 3% στο Marini et al. 2020, 75 ± 2% στους 27 ± 2 °C στο Damiens et al. 2019.
- **Κατηγορία:** laboratory
- **Πλαίσιο:** Marini: αποικία από το Τρέντο, πειράματα στους 10, 15, 25 και 30 °C, φωτοπερίοδος 12:12. Damiens: στέλεχος από τη Ρεϊνιόν, εργαστήριο μαζικής εκτροφής για την τεχνική στείρων εντόμων (SIT).
- **Απόσπασμα:** "RH was controlled and fixed at 80 ± 3%"
- **Πηγή:** Marini G, Manica M, Arnoldi D, Inama E, Rosà R, Rizzoli A. Influence of temperature on the life-cycle dynamics of Aedes albopictus population established at temperate latitudes: a laboratory experiment. Insects. 2020;11(11):808. DOI [10.3390/insects11110808](https://doi.org/10.3390/insects11110808) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7698496/). Δεύτερη πηγή: Damiens D, Marquereau L, Lebon C, Le Goff G, Gaudillat B, Habchi-Hanriot N, Gouagna LC. Adult medium mass rearing for SIT program development. Insects. 2019;10(8):246. DOI [10.3390/insects10080246](https://doi.org/10.3390/insects10080246)
- **Επαλήθευση:** ναι, ως συνθήκη εργαστηρίου.
- **Σημειώσεις:** Η υγρασία εκτροφής επιλέγεται για πρακτικούς λόγους και αλλάζει από εργαστήριο σε εργαστήριο· δεν δείχνει ότι το είδος χρειάζεται 75–80% στο ύπαιθρο. Να μη χρησιμοποιηθεί ως όριο καταλληλότητας.

### 10. Υγρασία: απόλυτη υγρασία πάνω από 10 g/m³
- **Τιμή:** η πιθανότητα παρουσίας αυξάνεται πάνω από περίπου 10 g/m³ ετήσιας διάμεσης απόλυτης υγρασίας· δεν βρέθηκε ανώτατο όριο. Ίδια απόκριση για Ae. albopictus και Ae. aegypti.
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** παγκόσμια δεδομένα παρουσίας των δύο ειδών· σύνολο μοντέλων boosted regression trees (το MaxEnt αφαιρέθηκε από το τελικό), ανάλυση περίπου 5 km· απόλυτη υγρασία από την επανανάλυση ERA (σημείο δρόσου και θερμοκρασία, μετατροπή Tetens).
- **Απόσπασμα:** "increased probability of presence with values above 10 g/m3"
- **Πηγή:** Dickens BL, Sun H, Jit M, Cook AR, Carrasco LR. Determining environmental and anthropogenic factors which explain the global distribution of Aedes aegypti and Ae. albopictus. BMJ Glob Health. 2018;3(4):e000801. DOI [10.1136/bmjgh-2018-000801](https://doi.org/10.1136/bmjgh-2018-000801) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6135425/)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Συσχετιστικό παγκόσμιο μοντέλο, όχι φυσιολογικό όριο. Το Kraemer et al. 2015 (eLife 4:e08347) δεν χρησιμοποίησε καθόλου υγρασία: είχε θερμική καταλληλότητα, ελάχιστη και μέγιστη βροχή, EVI και αστικότητα (για το Ae. albopictus η θερμική καταλληλότητα συνεισέφερε 44,3%). Στο ίδιο μοντέλο του Dickens η παρουσία του Ae. albopictus αυξάνεται όπου η ετήσια ελάχιστη θερμοκρασία είναι τουλάχιστον περίπου 2 °C.

### 11. Άνεμος: περίπου 4–4,3 m/s
- **Τιμή:** με μέση ταχύτητα ανέμου των 5 εβδομάδων πριν από τη δειγματοληψία, καμία επίδραση μεταξύ 3,7 και 4,3 m/s και αρνητική σχέση με την αφθονία πάνω από 4,3 m/s.
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** Μονπελιέ (Γαλλία), Μάιος–Οκτώβριος 2023, παγίδες BG-Pro με δόλωμα και CO₂, random forest.
- **Απόσπασμα:** "no effect on abundance between 3.7 m/s and 4.3 m/s, but [...] negative correlation beyond"
- **Πηγή:** Bartholomée C, Taconet P, Mercat M, Grail C, Bouhsira E, Fournet F, Moiroux N. Investigating the role of urban vegetation alongside other environmental variables in shaping Aedes albopictus presence and abundance in Montpellier, France. PLoS One. 2025;20(11):e0335793. DOI [10.1371/journal.pone.0335793](https://doi.org/10.1371/journal.pone.0335793)
- **Επαλήθευση:** μερική. Το 4,3 m/s επιβεβαιώνεται. Το «4 m/s», που το Bartholomée αποδίδει στο Adeleke et al. 2022, δεν βρέθηκε στο κείμενο εκείνης της εργασίας.
- **Σημειώσεις:** Adeleke ED, Shittu RA, Beierkuhnlein C, Thomas SM. High wind speed prevents the establishment of the disease vector mosquito Aedes albopictus in its climatic niche in Europe. Front Environ Sci. 2022;10:846243, DOI [10.3389/fenvs.2022.846243](https://doi.org/10.3389/fenvs.2022.846243). Σε αυτό το μοντέλο (MaxEnt, ετήσιος μέσος άνεμος ERA5 στα 10 m) ο άνεμος μειώνει την προβλεπόμενη καταλληλότητα· κλιματικά κατάλληλες περιοχές χωρίς το είδος είχαν μέσο άνεμο 3,12 m/s, έναντι 2,54 m/s εκεί όπου έχει εγκατασταθεί. Οι περισσότερες περιοχές με το είδος είχαν 1,5–4,5 m/s, και η Αττική και η Λακωνία αναφέρονται ανάμεσα στις περιοχές με εγκατεστημένους ή εισαχθέντες πληθυσμούς παρά τον άνεμο πάνω από 4,5 m/s. Σε ωριαία κλίμακα η πυκνότητα μειωνόταν με τον άνεμο (Yin et al. 2019). Ωριαίος άνεμος, μέσος όρος 5 εβδομάδων και ετήσιος άνεμος στα 10 m από επανανάλυση είναι διαφορετικά μεγέθη· οι τιμές τους δεν μεταφέρονται από το ένα στο άλλο.

### 12. Βλάστηση: θετική σχέση με τη χαμηλή βλάστηση
- **Τιμή:** το ποσοστό χαμηλής βλάστησης (κάτω από 3 m) σε ακτίνα 250 m αύξανε μέτρια την αφθονία· η αστική βλάστηση είχε περιορισμένη επίδραση στην παρουσία.
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** Μονπελιέ 2023, σε πάρκα, κατοικημένες περιοχές και το αδιαπέρατο κέντρο· χάρτης κάλυψης γης 0,5 m (Pléiades, LiDAR, Urban Atlas)· random forest. Ο σημαντικότερος προβλεπτής της αφθονίας ήταν το μέσο μέγεθος των κηλίδων χαμηλής βλάστησης.
- **Απόσπασμα:** "low vegetation cover within a 250 m radius around traps moderately increased abundance"
- **Πηγή:** Bartholomée et al. 2025 (όπως στο #11). DOI [10.1371/journal.pone.0335793](https://doi.org/10.1371/journal.pone.0335793)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Μία πόλη, μία σεζόν, συσχετιστικό μοντέλο. Το τι μετράει ως «χαμηλή βλάστηση» εξαρτάται από τον χάρτη κάλυψης γης.

### 13. Βλάστηση: 10–23% σε ακτίνα 250 m
- **Τιμή:** θετική επίδραση στην αφθονία μεταξύ 10% και 23% κάλυψης χαμηλής βλάστησης σε 250 m· πάνω από 23% καμία επιπλέον επίδραση (πλατό, όχι πτώση).
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** όπως στο #12 (ο τέταρτος σημαντικότερος παράγοντας της αφθονίας).
- **Απόσπασμα:** "positive effect between 10% and 23%, beyond which it had no observable effect"
- **Πηγή:** Bartholomée et al. 2025 (όπως στο #11). DOI [10.1371/journal.pone.0335793](https://doi.org/10.1371/journal.pone.0335793)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Τοπικό αποτέλεσμα· για τις ελληνικές πόλεις δείχνει την ιδέα, δεν δίνει όριο.

### 14. Θερμοκρασία, πλαίσιο: R0 (Mordecai et al. 2017)
- **Τιμή:** η δυνητική μετάδοση (R0, δάγκειος με φορέα το Ae. albopictus) κορυφώνεται στους 26,4 °C (95% CI 25,2–27,4) και μηδενίζεται κάτω από 16,2 °C (13,2–19,9) και πάνω από 31,6 °C (29,4–33,7).
- **Κατηγορία:** statistical/mechanistic model result
- **Πλαίσιο:** μηχανιστικό μοντέλο R0(T) από Bayesian καμπύλες θερμικής απόκρισης πάνω σε δημοσιευμένα εργαστηριακά δεδομένα (χαρακτηριστικά κουνουπιού και ιού), ελεγμένο με κρούσματα στην αμερικανική ήπειρο.
- **Απόσπασμα:** "transmission peaked at 26.4°C (95% CI: 25.2–27.4°C) and declined to zero below 16.2°C"
- **Πηγή:** Mordecai EA, Cohen JM, Evans MV, Gudapati P, Johnson LR, Lippi CA, et al. Detecting the impact of temperature on transmission of Zika, dengue, and chikungunya using mechanistic models. PLoS Negl Trop Dis. 2017;11(4):e0005568. DOI [10.1371/journal.pntd.0005568](https://doi.org/10.1371/journal.pntd.0005568)
- **Επαλήθευση:** ναι, ακριβώς 16,2 / 26,4 / 31,6 °C.
- **Σημειώσεις:** Είναι όρια για τη δυνητική μετάδοση, όχι για την επιβίωση ή τη δραστηριότητα του κουνουπιού, γιατί το R0 περιέχει και χαρακτηριστικά του ιού. Για καμπύλη μόνο του κουνουπιού δες το #15. Το άρθρο γράφει ότι τα χαρακτηριστικά των κουνουπιών κορυφώνονται μεταξύ 23 και 34 °C και για τα δύο είδη. Η διόρθωση του 2022 (PLoS Negl Trop Dis 16(6):e0010514) αφορά συμπληρωματικά σχήματα και μία συμπληρωματική παράγραφο, όχι αυτές τις τιμές.

### 15. Θερμοκρασία, πλαίσιο: θερμικά όρια χαρακτηριστικών του κουνουπιού
- **Τιμή** (S2 Text, Table A· μέση τιμή και 95% CI, σε °C):

| Χαρακτηριστικό | T0 (κάτω όριο) | Tm (πάνω όριο) | Καμπύλη | Βέλτιστο (δικός μας υπολογισμός) |
|---|---|---|---|---|
| Ρυθμός τσιμπημάτων (a) | 10,25 (5,84–14,82) | 38,32 (36,60–40,51) | Brière | ≈ 31,9 |
| Αυγά ανά θηλυκό ανά γονοτροφικό κύκλο (TFD) | 8,02 (3,18–13,08) | 35,65 (35,00–36,51) | Brière | ≈ 29,5 |
| Επιβίωση από αυγό σε ενήλικο (pEA) | 9,04 (6,37–11,67) | 39,33 (37,17–41,62) | τετραγωνική | ≈ 24,2 |
| Ρυθμός ανάπτυξης από αυγό σε ενήλικο (MDR) | 8,60 (4,43–12,29) | 39,66 (37,78–41,70) | Brière | ≈ 32,7 |
| Διάρκεια ζωής ενηλίκου (lf) | 13,41 (10,53–16,11) | 31,51 (29,14–33,57) | τετραγωνική | ≈ 22,5 |

- **Κατηγορία:** statistical/mechanistic model result (καμπύλες πάνω σε εργαστηριακά δεδομένα)
- **Απόσπασμα:** παράφραση του Table A (μέση τιμή και 95% CI των T0 και Tm για κάθε χαρακτηριστικό).
- **Πηγή:** Mordecai et al. 2017, Supporting Information S2 Text, Table A. DOI [10.1371/journal.pntd.0005568](https://doi.org/10.1371/journal.pntd.0005568) · [αρχείο S2](https://journals.plos.org/plosntds/article/file?type=supplementary&id=10.1371/journal.pntd.0005568.s002)
- **Επαλήθευση:** ναι.
- **Σημειώσεις:** Τα T0 και Tm είναι τα σημεία όπου μηδενίζεται η προσαρμοσμένη καμπύλη (προέκταση από σταθερές θερμοκρασίες εργαστηρίου), όχι παρατηρημένα όρια θανάτου, και τα διαστήματα είναι φαρδιά. Τα βέλτιστα της τελευταίας στήλης δεν υπάρχουν στο άρθρο: τα υπολογίσαμε από τις μέσες τιμές T0 και Tm και είναι προσεγγίσεις. Η διάρκεια ζωής του ενηλίκου έχει το χαμηλότερο πάνω όριο (31,5 °C, σχεδόν ίδιο με το 31,6 °C του R0)· το S1 Text γράφει ότι το R0 περιορίζεται έντονα από τη μικρή διάρκεια ζωής των κουνουπιών στις υψηλές θερμοκρασίες.

## Πόσο ισχυρά είναι τα στοιχεία

### Θερμοκρασία: ισχυρά
Είναι η καλύτερα τεκμηριωμένη παράμετρος, με ανεξάρτητες γραμμές στοιχείων που συμφωνούν μεταξύ τους: εργαστήριο (Delatte 2009, Marini 2020), πεδίο (Roiz 2010, Yin 2019), όρια κατανομής που επιβεβαιώθηκαν σε νέα περιοχή (Kobayashi 2002 στην Ιαπωνία, Roiz 2011 στο Τρεντίνο) και μηχανιστικά μοντέλα (Mordecai 2017). Όλα τοποθετούν το βέλτιστο περίπου στους 25–30 °C. Οι αδυναμίες: τα εργαστηριακά δεδομένα είναι σε σταθερές θερμοκρασίες, οι πληθυσμοί διαφέρουν (τροπικός από τη Ρεϊνιόν, υποτροπικός από την Κίνα, εύκρατος από την Ιταλία), και τα όρια των 0 °C και 11 °C είναι στατιστικά υποκατάστατα για χάρτες, όχι όρια θανάτου. Για την Ελλάδα, δική μας εκτίμηση: τα 0 °C τον Ιανουάριο και τα 11 °C ετήσια μέση μάλλον ξεχωρίζουν κυρίως ορεινές και βόρειες ηπειρωτικές περιοχές, όπως στο Τρεντίνο· αξίζει να ελεγχθεί με τα δεδομένα της εφαρμογής. Στα ζεστά πεδινά μετράει περισσότερο το πάνω όριο: η διάρκεια ζωής του ενηλίκου μηδενίζεται γύρω στους 31,5 °C στις καμπύλες του Mordecai, και το μοντέλο ECDC (μέσω Caminade 2012) υποθέτει ότι η καταλληλότητα πέφτει όταν η μέση θερμοκρασία του καλοκαιριού ξεπερνά τους 25 °C και μηδενίζεται πάνω από 30 °C· αυτό είναι υπόθεση μοντέλου, όχι μέτρηση.

### Βροχόπτωση: αδύναμα έως μέτρια
Το όριο των 500 mm τον χρόνο είναι κριτήριο ειδικών της δεκαετίας του 1990 (Knudsen 1996), όχι αποτέλεσμα στατιστικού ελέγχου, και οι ίδιοι οι Roiz et al. σημειώνουν ότι το είδος ζει και σε ξηρότερες περιοχές. Στην Ελλάδα το είδος καταγράφηκε πρώτη φορά το 2003–2004 και στη συνέχεια εγκαταστάθηκε σε πολλές περιφερειακές ενότητες (Badieritakis 2018)· στις πόλεις οι εστίες γεμίζουν από πότισμα και δοχεία, όχι μόνο από τη βροχή. Το 90–800 mm σε 35 ημέρες προέρχεται από ένα τροπικό νησί και ένα εμπειρικό μοντέλο: το πάνω όριο σχεδόν ποτέ δεν φτάνεται στην Ελλάδα, και το κάτω θα έδινε λανθασμένα χαμηλή καταλληλότητα το καλοκαίρι. Τα ευρωπαϊκά δεδομένα πεδίου για τη βραχυπρόθεσμη βροχή διαφωνούν (αρνητική σχέση στη βόρεια Ιταλία, θετική στο Μονπελιέ). Πρόταση: μικρό βάρος για τη βροχή και κανένας αποκλεισμός περιοχής εξαιτίας της.

### Υγρασία: αδύναμα
Το 75–80% είναι μόνο συνθήκη εκτροφής και δεν πρέπει να χρησιμοποιηθεί ως περιβαλλοντικό όριο. Το όριο των 10 g/m³ απόλυτης υγρασίας στηρίζεται σε μία παγκόσμια συσχετιστική μελέτη (Dickens 2018) με χονδρική χωρική ανάλυση, ενώ η πιο γνωστή παγκόσμια μελέτη κατανομής (Kraemer 2015) δεν χρησιμοποίησε καθόλου υγρασία. Στο πεδίο η σχετική υγρασία δίνει αντίθετα αποτελέσματα: θετική ωριαία σχέση στη Γκουανγκζού (Yin 2019), αρνητική στο Μονπελιέ (Bartholomée 2025). Πρόταση: μικρός διορθωτικός παράγοντας, όχι όριο.

### Άνεμος: αδύναμα
Υπάρχει ένα όριο από μία πόλη και μία σεζόν (4,3 m/s ως μέσος όρος 5 εβδομάδων, Μονπελιέ) και ένα μοντέλο κόγχης για την Ευρώπη που δείχνει αρνητική επίδραση χωρίς σαφές όριο (Adeleke 2022). Το «4 m/s» δεν βρέθηκε στο κείμενο της Adeleke, και η ίδια εργασία βάζει την Αττική και τη Λακωνία ανάμεσα στις περιοχές με πληθυσμούς του είδους παρά τον ετήσιο μέσο άνεμο πάνω από 4,5 m/s. Ωριαίος, εβδομαδιαίος και ετήσιος άνεμος στα 10 m είναι διαφορετικά μεγέθη. Πρόταση: ήπια ποινή για τον ισχυρό άνεμο ή καμία, ποτέ αποκλεισμός.

### Βλάστηση: αδύναμα, τοπικά
Και τα δύο ευρήματα (#12, #13) προέρχονται από μία μελέτη σε μία πόλη (Μονπελιέ, 2023) με συσχετιστικό μοντέλο και εξαρτώνται από τον ορισμό του χάρτη κάλυψης γης (χαμηλή βλάστηση κάτω από 3 m, ανάλυση 0,5 m). Η βλάστηση εξηγούσε την αφθονία, όχι την παρουσία. Πρόταση: παράδειγμα για τους μαθητές («πού στην πόλη βρίσκουμε περισσότερα κουνούπια»), όχι κανόνας για την Ελλάδα.

## Τι δεν ελέγχθηκε απευθείας
- Medlock et al. 2006 (J Vector Ecol 31(2):292–304, DOI `10.3376/1081-1710(2006)31[292:AOTPFS]2.0.CO;2`, [PubMed](https://pubmed.ncbi.nlm.nih.gov/17249347/)): το πλήρες κείμενο είναι πίσω από paywall· οι τιμές του πάρθηκαν από το Caminade et al. 2012, όπου ο Medlock είναι συν-συγγραφέας.
- Mitchell 1995 (J Vector Ecol 20:44–58): δεν είναι online.
- Delatte et al. 2009, Roiz et al. 2010, Kobayashi et al. 2002 και Knudsen et al. 1996: διαβάστηκαν μόνο οι περιλήψεις στο PubMed.
- Το «4 m/s» του Adeleke et al. 2022 δεν βρέθηκε· η πλησιέστερη επαληθευμένη τιμή είναι τα 4,3 m/s του Bartholomée et al. 2025.

## Βιβλιογραφία
1. Adeleke ED, Shittu RA, Beierkuhnlein C, Thomas SM. High wind speed prevents the establishment of the disease vector mosquito Aedes albopictus in its climatic niche in Europe. Front Environ Sci. 2022;10:846243. https://doi.org/10.3389/fenvs.2022.846243
2. Badieritakis E, Papachristos D, Latinopoulos D, Stefopoulou A, Kolimenakis A, Bithas K, et al. Aedes albopictus (Skuse, 1895) (Diptera: Culicidae) in Greece: 13 years of living with the Asian tiger mosquito. Parasitol Res. 2018;117(2):453–460. https://doi.org/10.1007/s00436-017-5721-6
3. Bartholomée C, Taconet P, Mercat M, Grail C, Bouhsira E, Fournet F, Moiroux N. Investigating the role of urban vegetation alongside other environmental variables in shaping Aedes albopictus presence and abundance in Montpellier, France. PLoS One. 2025;20(11):e0335793. https://doi.org/10.1371/journal.pone.0335793
4. Caminade C, Medlock JM, Ducheyne E, McIntyre KM, Leach S, Baylis M, Morse AP. Suitability of European climate for the Asian tiger mosquito Aedes albopictus: recent trends and future scenarios. J R Soc Interface. 2012;9(75):2708–2717. https://doi.org/10.1098/rsif.2012.0138
5. Damiens D, Marquereau L, Lebon C, Le Goff G, Gaudillat B, Habchi-Hanriot N, Gouagna LC. Adult medium mass rearing for SIT program development. Insects. 2019;10(8):246. https://doi.org/10.3390/insects10080246
6. Delatte H, Gimonneau G, Triboire A, Fontenille D. Influence of temperature on immature development, survival, longevity, fecundity, and gonotrophic cycles of Aedes albopictus, vector of chikungunya and dengue in the Indian Ocean. J Med Entomol. 2009;46(1):33–41. https://doi.org/10.1603/033.046.0105
7. Dickens BL, Sun H, Jit M, Cook AR, Carrasco LR. Determining environmental and anthropogenic factors which explain the global distribution of Aedes aegypti and Ae. albopictus. BMJ Glob Health. 2018;3(4):e000801. https://doi.org/10.1136/bmjgh-2018-000801
8. Knudsen AB, Romi R, Majori G. Occurrence and spread in Italy of Aedes albopictus, with implications for its introduction into other parts of Europe. J Am Mosq Control Assoc. 1996;12(2 Pt 1):177–183. https://pubmed.ncbi.nlm.nih.gov/8827590/
9. Kobayashi M, Nihei N, Kurihara T. Analysis of northern distribution of Aedes albopictus (Diptera: Culicidae) in Japan by geographical information system. J Med Entomol. 2002;39(1):4–11. https://doi.org/10.1603/0022-2585-39.1.4
10. Kraemer MUG, Sinka ME, Duda KA, Mylne AQN, Shearer FM, Barker CM, et al. The global distribution of the arbovirus vectors Aedes aegypti and Ae. albopictus. eLife. 2015;4:e08347. https://doi.org/10.7554/eLife.08347
11. Marini G, Manica M, Arnoldi D, Inama E, Rosà R, Rizzoli A. Influence of temperature on the life-cycle dynamics of Aedes albopictus population established at temperate latitudes: a laboratory experiment. Insects. 2020;11(11):808. https://doi.org/10.3390/insects11110808
12. Medlock JM, Avenell D, Barrass I, Leach S. Analysis of the potential for survival and seasonal activity of Aedes albopictus (Diptera: Culicidae) in the United Kingdom. J Vector Ecol. 2006;31(2):292–304. https://pubmed.ncbi.nlm.nih.gov/17249347/ (δεν διαβάστηκε το πλήρες κείμενο)
13. Mordecai EA, Cohen JM, Evans MV, Gudapati P, Johnson LR, Lippi CA, et al. Detecting the impact of temperature on transmission of Zika, dengue, and chikungunya using mechanistic models. PLoS Negl Trop Dis. 2017;11(4):e0005568. https://doi.org/10.1371/journal.pntd.0005568
14. Roiz D, Rosà R, Arnoldi D, Rizzoli A. Effects of temperature and rainfall on the activity and dynamics of host-seeking Aedes albopictus females in northern Italy. Vector Borne Zoonotic Dis. 2010;10(8):811–816. https://doi.org/10.1089/vbz.2009.0098
15. Roiz D, Neteler M, Castellani C, Arnoldi D, Rizzoli A. Climatic factors driving invasion of the tiger mosquito (Aedes albopictus) into new areas of Trentino, northern Italy. PLoS One. 2011;6(4):e14800. https://doi.org/10.1371/journal.pone.0014800
16. Thomas SM, Obermayr U, Fischer D, Kreyling J, Beierkuhnlein C. Low-temperature threshold for egg survival of a post-diapause and non-diapause European aedine strain, Aedes albopictus (Diptera: Culicidae). Parasit Vectors. 2012;5:100. https://doi.org/10.1186/1756-3305-5-100
17. Tran A, Mangeas M, Demarchi M, Roux E, Degenne P, Haramboure M, et al. Complementarity of empirical and process-based approaches to modelling mosquito population dynamics with Aedes albopictus as an example—Application to the development of an operational mapping tool of vector populations. PLoS One. 2020;15(1):e0227407. https://doi.org/10.1371/journal.pone.0227407
18. Yin Q, Li L, Guo X, Wu R, Shi B, Wang Y, et al. A field-based modeling study on ecological characterization of hourly host-seeking behavior and its associated climatic variables in Aedes albopictus. Parasit Vectors. 2019;12:474. https://doi.org/10.1186/s13071-019-3715-1
