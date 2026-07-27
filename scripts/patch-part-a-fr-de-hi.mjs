/**
 * Spot-check FR/DE/HI translations for newly added Part A keys.
 * Usage: node scripts/patch-part-a-fr-de-hi.mjs
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src", "locales");

function writeJson(code, data) {
  const file = join(dir, `${code}.json`);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

const patches = {
  fr: {
    settings: {
      personalDesc: "Vos informations de contact et de carrière essentielles.",
      contactBackground: "Coordonnées et parcours",
      emailLocked: "L'e-mail ne peut pas être modifié ici",
      profileImageHint:
        "JPG, PNG ou WEBP privé jusqu'à 5 Mo. L'extension l'utilise uniquement pour les champs photo clairement étiquetés.",
      replaceImage: "Remplacer l'image",
      uploading: "Téléversement…",
      skillsHint: "Les compétences et les rôles cibles ont le plus fort impact sur la correspondance d'offres.",
      additionalDesc: "Détails facultatifs qui rendent votre profil plus complet.",
      autofillHint:
        "Contrôlez comment l'extension utilise les faits que vous avez confirmés. Elle n'invente jamais de réponse ni n'accepte de conditions juridiques à votre place.",
      extensionAutofillHint: "Utilisé par l'extension de navigateur pour le remplissage automatique des candidatures.",
      toastPartialTitle: "Enregistrement partiel",
      toastPartialBody: "Informations principales enregistrées. Certains champs nécessitent une migration de base de données.",
      toastImageUnsupportedTitle: "Image non prise en charge",
      toastImageUnsupportedBody: "Choisissez une image de profil JPG, PNG ou WEBP.",
      toastImageTooLargeTitle: "Image trop volumineuse",
      toastImageTooLargeBody: "Votre image de profil doit faire moins de 5 Mo.",
      toastImageUploadFailed: "Échec du téléversement de l'image",
      toastImageSaveFailed: "Impossible d'enregistrer l'image",
      toastImageUpdatedTitle: "Image de profil mise à jour",
      toastImageUpdatedBody: "Elle est prête pour les champs photo des candidatures prises en charge.",
      toastAtsFailed: "Les suggestions ATS n'ont pas pu être générées. Votre profil et votre CV sont inchangés.",
    },
    jobs: {
      toastLoadFailedBody: "Vos offres correspondantes n'ont pas pu être chargées. Veuillez réessayer.",
      toastScrapeStillRunningTitle: "La collecte est toujours en cours",
      toastScrapeStillRunningBody:
        "La connexion a été interrompue, mais JobAI Scout continue la session active.",
      toastScrapeStartFailedTitle: "Impossible de démarrer la collecte",
      toastScrapeStartFailedBody: "Vérifiez votre connexion et réessayez.",
      toastScrapePreparingTitle: "Préparation de la collecte",
      toastScrapePreparingBody:
        "Le contrôle d'arrêt sera disponible dès que la session sera enregistrée.",
      toastScrapeStopFailed: "Impossible d'arrêter la collecte",
      toastScrapeStoppedTitle: "Collecte arrêtée",
      toastScrapeStoppedBody:
        "Les offres déjà collectées ont été conservées et restent disponibles ci-dessous.",
      toastApplyFailed: "Candidature échouée",
      toastApplySubmitted: "Candidature envoyée",
      toastApplyLinkUnavailableTitle: "Lien de candidature indisponible",
      toastApplyLinkUnavailableBody:
        "Cette source n'a pas fourni de lien de candidature direct pour ce poste.",
      toastCoverFailedTitle: "Impossible d'adapter la lettre",
      toastCoverFailedBody: "Vérifiez votre profil et réessayez.",
      toastCopyBlockedTitle: "Copie bloquée",
      toastCopyBlockedBody: "Sélectionnez la lettre et copiez-la manuellement.",
      toastJobUnsaved: "Offre retirée des favoris",
      toastJobSaved: "Offre enregistrée !",
      tailoredCoverLetter: "Lettre de motivation adaptée",
    },
  },
  de: {
    settings: {
      personalDesc: "Ihre wesentlichen Kontakt- und Karriereinformationen.",
      contactBackground: "Kontakt & Hintergrund",
      emailLocked: "E-Mail kann hier nicht geändert werden",
      profileImageHint:
        "Privates JPG, PNG oder WEBP bis 5 MB. Die Erweiterung nutzt es nur für klar gekennzeichnete Foto-Felder.",
      replaceImage: "Bild ersetzen",
      uploading: "Wird hochgeladen…",
      skillsHint: "Fähigkeiten und Zielrollen haben den stärksten Einfluss auf Job-Matching.",
      additionalDesc: "Optionale Angaben, die Ihr Profil vollständiger machen.",
      autofillHint:
        "Steuern Sie, wie die Erweiterung von Ihnen bestätigte Fakten nutzt. Sie erfindet keine Antworten und akzeptiert keine rechtlichen Bedingungen für Sie.",
      extensionAutofillHint: "Wird von der Browser-Erweiterung für Autofill verwendet.",
      toastPartialTitle: "Teilweise gespeichert",
      toastPartialBody: "Kerndaten gespeichert. Einige Felder benötigen eine Datenbankmigration.",
      toastImageUnsupportedTitle: "Nicht unterstütztes Bild",
      toastImageUnsupportedBody: "Wählen Sie ein JPG-, PNG- oder WEBP-Profilbild.",
      toastImageTooLargeTitle: "Bild ist zu groß",
      toastImageTooLargeBody: "Ihr Profilbild muss kleiner als 5 MB sein.",
      toastImageUploadFailed: "Bild-Upload fehlgeschlagen",
      toastImageSaveFailed: "Bild konnte nicht gespeichert werden",
      toastImageUpdatedTitle: "Profilbild aktualisiert",
      toastImageUpdatedBody: "Es ist bereit für unterstützte Bewerbungs-Fotofelder.",
      toastAtsFailed: "ATS-Vorschläge konnten nicht erzeugt werden. Profil und Lebenslauf sind unverändert.",
    },
    jobs: {
      toastLoadFailedBody: "Ihre passenden Jobs konnten nicht geladen werden. Bitte erneut versuchen.",
      toastScrapeStillRunningTitle: "Scraping läuft noch",
      toastScrapeStillRunningBody:
        "Die Verbindung wurde unterbrochen, aber JobAI Scout setzt die aktive Sitzung fort.",
      toastScrapeStartFailedTitle: "Scraping konnte nicht gestartet werden",
      toastScrapeStartFailedBody: "Bitte Verbindung prüfen und erneut versuchen.",
      toastScrapePreparingTitle: "Scraping wird vorbereitet",
      toastScrapePreparingBody: "Die Stopp-Steuerung ist verfügbar, sobald die Sitzung registriert ist.",
      toastScrapeStopFailed: "Scraping konnte nicht gestoppt werden",
      toastScrapeStoppedTitle: "Scraping gestoppt",
      toastScrapeStoppedBody: "Bereits erfasste Jobs wurden behalten und bleiben unten verfügbar.",
      toastApplyFailed: "Bewerbung fehlgeschlagen",
      toastApplySubmitted: "Bewerbung eingereicht",
      toastApplyLinkUnavailableTitle: "Bewerbungslink nicht verfügbar",
      toastApplyLinkUnavailableBody: "Diese Quelle lieferte keinen direkten Bewerbungslink für diese Rolle.",
      toastCoverFailedTitle: "Anschreiben konnte nicht angepasst werden",
      toastCoverFailedBody: "Bitte Profil prüfen und erneut versuchen.",
      toastCopyBlockedTitle: "Kopieren blockiert",
      toastCopyBlockedBody: "Wählen Sie den Brief aus und kopieren Sie ihn manuell.",
      toastJobUnsaved: "Job nicht mehr gespeichert",
      toastJobSaved: "Job gespeichert!",
      tailoredCoverLetter: "Maßgeschneidertes Anschreiben",
    },
  },
  hi: {
    settings: {
      personalDesc: "आपकी आवश्यक संपर्क और करियर जानकारी।",
      contactBackground: "संपर्क और पृष्ठभूमि",
      emailLocked: "ईमेल यहाँ नहीं बदला जा सकता",
      profileImageHint:
        "निजी JPG, PNG या WEBP अधिकतम 5 MB। एक्सटेंशन इसे केवल स्पष्ट फोटो फ़ील्ड के लिए उपयोग करता है।",
      replaceImage: "छवि बदलें",
      uploading: "अपलोड हो रहा है…",
      skillsHint: "कौशल और लक्ष्य भूमिकाओं का जॉब मैचिंग पर सबसे अधिक प्रभाव पड़ता है।",
      additionalDesc: "वैकल्पिक विवरण जो आपके प्रोफ़ाइल को अधिक पूर्ण बनाते हैं।",
      autofillHint:
        "नियंत्रित करें कि एक्सटेंशन आपके द्वारा पुष्टि किए गए तथ्यों का उपयोग कैसे करे। यह उत्तर नहीं बनाता और कानूनी शर्तें स्वीकार नहीं करता।",
      extensionAutofillHint: "ब्राउज़र एक्सटेंशन आवेदन ऑटोफिल के लिए उपयोग करता है।",
      toastPartialTitle: "आंशिक रूप से सहेजा गया",
      toastPartialBody: "मुख्य जानकारी सहेजी गई। कुछ फ़ील्ड के लिए डेटाबेस माइग्रेशन चाहिए।",
      toastImageUnsupportedTitle: "असमर्थित छवि",
      toastImageUnsupportedBody: "JPG, PNG या WEBP प्रोफ़ाइल छवि चुनें।",
      toastImageTooLargeTitle: "छवि बहुत बड़ी है",
      toastImageTooLargeBody: "आपकी प्रोफ़ाइल छवि 5 MB से छोटी होनी चाहिए।",
      toastImageUploadFailed: "छवि अपलोड विफल",
      toastImageSaveFailed: "छवि सहेजी नहीं जा सकी",
      toastImageUpdatedTitle: "प्रोफ़ाइल छवि अपडेट",
      toastImageUpdatedBody: "यह समर्थित आवेदन फोटो फ़ील्ड के लिए तैयार है।",
      toastAtsFailed: "ATS सुझाव नहीं बन सके। आपका प्रोफ़ाइल और रिज़्यूमे अपरिवर्तित हैं।",
    },
    jobs: {
      toastLoadFailedBody: "आपकी मिलान वाली नौकरियाँ लोड नहीं हो सकीं। फिर कोशिश करें।",
      toastScrapeStillRunningTitle: "स्क्रेपिंग अभी भी चल रही है",
      toastScrapeStillRunningBody: "कनेक्शन टूट गया, लेकिन JobAI Scout सक्रिय सत्र जारी रख रहा है।",
      toastScrapeStartFailedTitle: "स्क्रेपिंग शुरू नहीं हो सकी",
      toastScrapeStartFailedBody: "कृपया कनेक्शन जाँचें और फिर कोशिश करें।",
      toastScrapePreparingTitle: "स्क्रेप तैयार हो रहा है",
      toastScrapePreparingBody: "सत्र पंजीकृत होते ही स्टॉप नियंत्रण उपलब्ध होगा।",
      toastScrapeStopFailed: "स्क्रेपिंग रोक नहीं सके",
      toastScrapeStoppedTitle: "स्क्रेपिंग रोकी गई",
      toastScrapeStoppedBody: "पहले से एकत्र नौकरियाँ रखी गईं और नीचे उपलब्ध हैं।",
      toastApplyFailed: "आवेदन विफल",
      toastApplySubmitted: "आवेदन जमा",
      toastApplyLinkUnavailableTitle: "आवेदन लिंक उपलब्ध नहीं",
      toastApplyLinkUnavailableBody: "इस स्रोत ने इस भूमिका के लिए सीधा आवेदन लिंक नहीं दिया।",
      toastCoverFailedTitle: "पत्र अनुकूलित नहीं हो सका",
      toastCoverFailedBody: "कृपया प्रोफ़ाइल जाँचें और फिर कोशिश करें।",
      toastCopyBlockedTitle: "कॉपी अवरुद्ध",
      toastCopyBlockedBody: "पत्र चुनें और मैन्युअल रूप से कॉपी करें।",
      toastJobUnsaved: "नौकरी सहेजी नहीं रही",
      toastJobSaved: "नौकरी सहेजी गई!",
      tailoredCoverLetter: "अनुकूलित कवर लेटर",
    },
  },
};

for (const [code, patch] of Object.entries(patches)) {
  const data = JSON.parse(readFileSync(join(dir, `${code}.json`), "utf8"));
  for (const [ns, values] of Object.entries(patch)) {
    data[ns] = { ...(data[ns] || {}), ...values };
  }
  writeJson(code, data);
  console.log(`Patched ${code}`);
}
