import { beforeEach, describe, expect, it, vi } from "vitest";

const picnic = vi.hoisted(() => ({
  buildClient: vi.fn(),
  sendRequest: vi.fn(),
  getUserDetails: vi.fn(),
  getProfileMenu: vi.fn(),
  setHouseholdDetails: vi.fn(),
}));

vi.mock("@/lib/picnic/client", () => ({
  buildPicnicClient: picnic.buildClient,
}));

import { updateAccountNameService } from "@/lib/api-services/account";

describe("account service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    picnic.buildClient.mockReturnValue({
      sendRequest: picnic.sendRequest,
      user: {
        getUserDetails: picnic.getUserDetails,
        getProfileMenu: picnic.getProfileMenu,
      },
      userOnboarding: {
        setHouseholdDetails: picnic.setHouseholdDetails,
      },
    });
    picnic.sendRequest.mockResolvedValue(undefined);
    picnic.getUserDetails.mockResolvedValue({ firstname: "Ada", lastname: "Lovelace" });
    picnic.getProfileMenu.mockResolvedValue({ user: { name: "Ada Lovelace" } });
  });

  it("uses the captured API v15 POST /user name mutation", async () => {
    const result = await updateAccountNameService("test-token", "NL", {
      firstname: " Ada ",
      lastname: " Lovelace ",
    });

    expect(picnic.buildClient).toHaveBeenNthCalledWith(1, "test-token", "NL", "15");
    expect(picnic.buildClient).toHaveBeenNthCalledWith(2, "test-token", "NL");
    expect(picnic.sendRequest).toHaveBeenCalledWith(
      "POST",
      "/user",
      { firstname: "Ada", lastname: "Lovelace" },
      true
    );
    expect(result.status).toBeUndefined();
    expect(result.body).toMatchObject({
      user: { firstname: "Ada", lastname: "Lovelace" },
      profileMenu: { user: { name: "Ada Lovelace" } },
    });
  });
});
