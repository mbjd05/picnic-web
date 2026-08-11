export type AccountAddress = {
  id?: string | null;
  house_number?: number | null;
  house_number_ext?: string | null;
  postcode?: string | null;
  street?: string | null;
  city?: string | null;
};

export type RetrievedAddress = {
  id: string;
  formatted_address?: string | null;
  city: string;
  street: string;
  house_number: number;
  house_number_ext?: string | null;
  postcode: string;
  coordinates?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  signature: string;
};

export type AddressSuggestion = {
  address_id: string;
  name: string;
  place?: string | null;
  postcode?: string | null;
  feature_type?: string | null;
};

export type AddressSuggestionsResponse = {
  suggestions: AddressSuggestion[];
};

export type AddressRetrieveResponse = {
  address: RetrievedAddress;
  registrationProperties: {
    b2b_enabled?: boolean | null;
    waitlist_area?: boolean | null;
  } | null;
};

export type AddressUpdateResponse = {
  user: AccountUser;
};

export type AddressSpecification = {
  user_id?: string | null;
  address_id?: string | null;
  delivery_instruction?: string | null;
  updated_at?: number | null;
  address_specification?: {
    access_codes?: string[];
    building_type?: string | null;
    building_identifier?: string | null;
    floor?: number | null;
    apartment_number?: string | null;
    front_door_guidance?: string | null;
    intercom?: string | null;
    additional_details?: string | null;
    elevator?: boolean | null;
  } | null;
};

export type AddressSpecificationRequest = {
  addressId: string;
  deliveryInstruction?: string | null;
  addressSpecification: {
    accessCodes?: string[];
    buildingType?: string | null;
    buildingIdentifier?: string | null;
    floor?: number | null;
    frontDoorGuidance?: string | null;
    elevator?: boolean | null;
  };
};

export type AddressSpecificationResponse = {
  enabledFields: string[];
  specifications: AddressSpecification[];
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
      image_id?: string | null;
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
  currentAvatar: AccountAvatar | null;
  consentSettings: ConsentSetting[];
  generalConsentSettings: ConsentSetting[];
};

export type AccountAvatar = {
  type?: string | null;
  image_id?: string | null;
  image_url?: string | null;
};

export type AccountAvatarOption = {
  image_id: string;
  image_url: string;
  name?: string | null;
};

export type AccountAvatarOptionsResponse = {
  avatars: AccountAvatarOption[];
};

export type AccountAvatarUpdateResponse = {
  avatar: AccountAvatar;
  profileMenu: ProfileMenu;
};

export type AccountHouseholdUpdateResponse = {
  user: AccountUser;
};

export type AccountNameUpdateResponse = {
  user: AccountUser;
  profileMenu: ProfileMenu;
};

export type AccountConsentUpdateResponse = {
  user: AccountUser;
  consentSettings: ConsentSetting[];
  generalConsentSettings: ConsentSetting[];
  result: {
    consent_request_text_ids?: string[];
  } | null;
};
