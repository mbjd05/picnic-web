export type AccountAddress = {
  id?: string | null;
  house_number?: number | null;
  house_number_ext?: string | null;
  postcode?: string | null;
  street?: string | null;
  city?: string | null;
};

export type HouseholdDetails = {
  adults?: number | null;
  children?: number | null;
  cats?: number | null;
  dogs?: number | null;
  author?: string | null;
  last_edit_ts?: number | null;
};

export type AccountSubscription = {
  list_id?: string | null;
  name?: string | null;
  subscribed?: boolean | null;
};

export type AccountUser = {
  user_id?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  address?: AccountAddress | null;
  phone?: string | null;
  contact_email?: string | null;
  customer_type?: string | null;
  household_details?: HouseholdDetails | null;
  subscriptions?: AccountSubscription[];
  push_subscriptions?: AccountSubscription[];
  total_deliveries?: number | null;
  completed_deliveries?: number | null;
  placed_order?: boolean | null;
  received_delivery?: boolean | null;
  check_general_consent?: boolean | null;
  consent_decisions?: Record<string, boolean>;
};

export type AccountUserInfo = {
  user_id?: string | null;
  redacted_phone_number?: string | null;
  feature_toggles?: Array<{ name?: string | null }>;
};

export type ProfileMenu = {
  user?: {
    name?: string | null;
    address?: AccountAddress | null;
    avatar?: {
      type?: string | null;
      image_url?: string | null;
    } | null;
  } | null;
  highlights?: Array<{
    feature_name?: string | null;
    targeted_content_id?: string | null;
    pml?: unknown;
  }>;
};

export type ConsentSetting = {
  type?: string | null;
  id?: string | null;
  text_id?: string | null;
  text_locale?: string | null;
  text?: {
    title?: string | null;
    text?: string | null;
    dissent_text?: string | null;
    timestamp?: string | null;
  } | null;
  established_decision?: boolean | null;
  initial_state?: boolean | null;
};

export type AccountProfileResponse = {
  user: AccountUser;
  userInfo: AccountUserInfo;
  profileMenu: ProfileMenu;
  consentSettings: ConsentSetting[];
  generalConsentSettings: ConsentSetting[];
};

export type AccountHouseholdUpdateResponse = {
  user: AccountUser;
};

export type AccountConsentUpdateResponse = {
  consentSettings: ConsentSetting[];
  result: {
    consent_request_text_ids?: string[];
  } | null;
};
