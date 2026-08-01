import { describe, expect, it } from "vitest";

import { localizeApiSectionTitle } from "@/lib/i18n/localize-api-label";
import { getTranslations } from "@/lib/i18n/translations";

describe("API label localization", () => {
  it("localizes known generic section labels to the display language", () => {
    expect(localizeApiSectionTitle("Bekijk ook", getTranslations("EN"))).toBe("See also");
    expect(localizeApiSectionTitle("Bekijk ook", getTranslations("DE"))).toBe("Siehe auch");
    expect(localizeApiSectionTitle("See also", getTranslations("NL"))).toBe("Bekijk ook");
  });

  it("localizes generated all-results labels while preserving the query", () => {
    expect(localizeApiSectionTitle('Alle resultaten voor "banaan"', getTranslations("EN"))).toBe(
      'All results for "banaan"'
    );
    expect(localizeApiSectionTitle('All results for "apple"', getTranslations("NL"))).toBe(
      'Alle resultaten voor "apple"'
    );
  });

  it("leaves real API category titles untouched", () => {
    expect(localizeApiSectionTitle("Fruit", getTranslations("EN"))).toBe("Fruit");
    expect(localizeApiSectionTitle("Aardappelen, groente en fruit", getTranslations("EN"))).toBe(
      "Aardappelen, groente en fruit"
    );
  });
});
