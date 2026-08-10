import type { ConsentSetting } from "@/types/account";
import type { LanguageCode } from "@/types/locale";

type ConsentDisplayText = {
  title: string;
  text: string;
};

const consentDisplayTextById: Record<string, Record<LanguageCode, ConsentDisplayText>> = {
  "f82ad0a2-97ba-41a1-a2a3-833aa59affbe": {
    NL: {
      title: "E-mails",
      text: "We sturen je e-mails om je op de hoogte te houden, bijvoorbeeld over levertijden, recepten en cadeautjes.",
    },
    EN: {
      title: "Emails",
      text: "Picnic may email you updates, for example about delivery times, recipes, and gifts.",
    },
    DE: {
      title: "E-Mails",
      text: "Picnic darf dir E-Mails senden, zum Beispiel zu Lieferzeiten, Rezepten und Geschenken.",
    },
    FR: {
      title: "E-mails",
      text: "Picnic peut vous envoyer des e-mails, par exemple sur les créneaux de livraison, les recettes et les cadeaux.",
    },
  },
  "7759b7d5-fb63-474c-9452-f7f2673924dc": {
    NL: {
      title: "Pushberichten",
      text: "Picnic mag je pushberichten sturen, bijvoorbeeld als herinnering om op tijd te bestellen of voor aanbiedingen en cadeautjes.",
    },
    EN: {
      title: "Push notifications",
      text: "Picnic may send push notifications, for example order reminders, offers, and gifts.",
    },
    DE: {
      title: "Push-Mitteilungen",
      text: "Picnic darf dir Push-Mitteilungen senden, zum Beispiel Bestellerinnerungen, Angebote und Geschenke.",
    },
    FR: {
      title: "Notifications push",
      text: "Picnic peut vous envoyer des notifications push, par exemple des rappels de commande, des offres et des cadeaux.",
    },
  },
  "03df8fc8-992b-44b5-9995-c74dbefa5e33": {
    NL: {
      title: "Gepersonaliseerde app",
      text: "Picnic mag de app aanpassen op basis van hoe je de app gebruikt, zodat recepten en producten beter bij je passen.",
    },
    EN: {
      title: "Personalized app",
      text: "Picnic may personalize the app based on how you use it, so recipes and products better match you.",
    },
    DE: {
      title: "Personalisierte App",
      text: "Picnic darf die App anhand deiner Nutzung personalisieren, damit Rezepte und Produkte besser zu dir passen.",
    },
    FR: {
      title: "Application personnalisée",
      text: "Picnic peut personnaliser l'application selon votre utilisation, afin que les recettes et produits vous correspondent mieux.",
    },
  },
  "c89a14bb-1226-43c5-9959-041ebf7466a9": {
    NL: {
      title: "Post",
      text: "Picnic mag je af en toe persoonlijke post sturen, bijvoorbeeld met nieuws of cadeautjes.",
    },
    EN: {
      title: "Post",
      text: "Picnic may occasionally send you personal mail, for example with news or gifts.",
    },
    DE: {
      title: "Post",
      text: "Picnic darf dir gelegentlich persönliche Post senden, zum Beispiel mit Neuigkeiten oder Geschenken.",
    },
    FR: {
      title: "Courrier",
      text: "Picnic peut vous envoyer occasionnellement du courrier personnalisé, par exemple avec des nouvelles ou des cadeaux.",
    },
  },
  "fc0103d0-282e-4a24-9ebf-bffc7a84f94d": {
    NL: {
      title: "Communicatie en advertenties personaliseren",
      text: "Picnic mag cookies en vergelijkbare technieken gebruiken om berichten en advertenties relevanter te maken.",
    },
    EN: {
      title: "Personalized communication and ads",
      text: "Picnic may use cookies and similar technologies to make messages and ads more relevant.",
    },
    DE: {
      title: "Personalisierte Kommunikation und Werbung",
      text: "Picnic darf Cookies und ähnliche Technologien nutzen, um Nachrichten und Werbung relevanter zu machen.",
    },
    FR: {
      title: "Communications et publicités personnalisées",
      text: "Picnic peut utiliser des cookies et technologies similaires pour rendre les messages et publicités plus pertinents.",
    },
  },
  "ec6ab75a-a246-4ae2-b631-1afde465353e": {
    NL: {
      title: "Wekelijkse actiemail",
      text: "Je ontvangt iedere week een e-mail met aanbiedingen voor de komende week.",
    },
    EN: {
      title: "Weekly offers email",
      text: "You receive a weekly email with offers for the coming week.",
    },
    DE: {
      title: "Wöchentliche Angebotsmail",
      text: "Du erhältst jede Woche eine E-Mail mit Angeboten für die kommende Woche.",
    },
    FR: {
      title: "E-mail d'offres hebdomadaire",
      text: "Vous recevez chaque semaine un e-mail avec les offres de la semaine à venir.",
    },
  },
  "3dd29f33-0f1c-4e7f-a8f1-bf9ca167ae8d": {
    NL: {
      title: "Persoonlijke acties",
      text: "Je ontvangt extra korting op basis van je eerdere aankopen.",
    },
    EN: {
      title: "Personal offers",
      text: "You receive extra discounts based on your previous purchases.",
    },
    DE: {
      title: "Persönliche Angebote",
      text: "Du erhältst zusätzliche Rabatte auf Basis deiner bisherigen Einkäufe.",
    },
    FR: {
      title: "Offres personnalisées",
      text: "Vous recevez des réductions supplémentaires selon vos achats précédents.",
    },
  },
  "b9f0f51f-9fed-4acf-bb77-94ebf255e789": {
    NL: {
      title: "Favorieten",
      text: "Picnic mag eerder bestelde producten tonen in je favorieten en andere handige overzichten.",
    },
    EN: {
      title: "Favorites",
      text: "Picnic may show previously ordered products in your favorites and other helpful overviews.",
    },
    DE: {
      title: "Favoriten",
      text: "Picnic darf bereits bestellte Produkte in deinen Favoriten und anderen hilfreichen Übersichten anzeigen.",
    },
    FR: {
      title: "Favoris",
      text: "Picnic peut afficher les produits déjà commandés dans vos favoris et d'autres aperçus utiles.",
    },
  },
};

export function getConsentDisplayText(
  setting: ConsentSetting,
  languageCode: LanguageCode
): ConsentDisplayText {
  const localized = setting.text_id
    ? consentDisplayTextById[setting.text_id]?.[languageCode]
    : null;

  return {
    title: localized?.title ?? setting.text?.title ?? setting.type ?? "",
    text: localized?.text ?? setting.text?.text ?? "",
  };
}
