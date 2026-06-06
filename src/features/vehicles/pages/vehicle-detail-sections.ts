/** Field groups for vehicle detail — aligned with `VehicleCreatePage` sections / labels. */

export type VehicleDetailLookupKind =
  | "groups"
  | "vehicleStatus"
  | "vehicleMovementStatus"
  | "insuranceProvider";

export type VehicleDetailField = {
  /** API keys tried in order (first present value wins). */
  keys: readonly string[];
  label: string;
  /** How to resolve UUIDs to display labels on the detail page. */
  lookup?: VehicleDetailLookupKind;
};

export type VehicleDetailSection = {
  id: string;
  title: string;
  subtitle: string;
  fields: readonly VehicleDetailField[];
};

export const VEHICLE_DETAIL_SECTIONS: readonly VehicleDetailSection[] = [
  {
    id: "basic",
    title: "Basic Information",
    subtitle: "Core identification details of the vehicle.",
    fields: [
      {
        keys: ["identification_code", "identificationCode"],
        label: "Identification Code",
      },
      {
        keys: ["registration_number", "registrationNumber"],
        label: "Registration Number",
      },
     
      { keys: ["make", "vehicle_make"], label: "Make" },
      { keys: ["model", "vehicle_model"], label: "Model" },
      { keys: ["color"], label: "Color" },
      {
        keys: ["manufacturing_year", "manufacturingYear", "year", "model_year"],
        label: "Manufacturing Year",
      },
      {
        keys: ["chassis_number", "chassisNumber"],
        label: "Chassis Number",
      },
      {
        keys: ["registration_date", "registrationDate"],
        label: "Registration Date",
      },
      {
        keys: ["registration_expiry", "registrationExpiry"],
        label: "Registration Expiry",
      },
      { keys: ["engine_number", "engineNumber"], label: "Engine Number" },
      {
        keys: [
          "engine_capacity_cc",
          "engineCapacityCc",
          "engine_capacity",
          "engineCapacity",
        ],
        label: "Engine Capacity (cc)",
      },
      {
        keys: ["seating_capacity", "seatingCapacity"],
        label: "Seating Capacity",
      },
      { keys: ["cost"], label: "Cost" },
      {
        keys: [
          "odometer_reading",
          "current_odometer_km",
          "odometer",
          "odo_meter",
        ],
        label: "Current Odometer Reading (km)",
      },
      {
        keys: ["last_service_date", "lastServiceDate"],
        label: "Last Service Date",
      },
      {
        keys: [
          "gps_device_imei",
          "gpsDeviceImei",
          "gps_device_id",
          "gpsDeviceId",
        ],
        label: "GPS Device",
      },
      {
        keys: [
          "status_id",
          "statusId",
          "vehicle_status_id",
          "vehicleStatusId",
          "vehicle_status_name",
          "status_name",
          "vehicle_status",
          "vehicleStatus",
          "status",
        ],
        label: "Vehicle Status",
        lookup: "vehicleStatus",
      },
    ],
  },
  {
    id: "classification",
    title: "Classification",
    subtitle: "Categorization and current status.",
    fields: [
      {
        keys: ["assigned_driver_id", "assignedDriverId"],
        label: "Assigned Driver",
      },

      {
        keys: [
          "vehicle_category_name",
          "vehicle_category",
          "vehicleCategory",
          "vehicle_category_id",
        ],
        label: "Vehicle Category",
      },
      {
        keys: ["fuel_type_name", "fuel_type", "fuelType", "fuel_type_id"],
        label: "Fuel Type",
      },

      {
        keys: [
          "movement_status_id",
          "movementStatusId",
          "vehicle_movement_status_id",
          "vehicleMovementStatusId",
          "vehicle_movement_status_name",
          "movement_status_name",
          "vehicle_movement_status",
          "vehicleMovementStatus",
          "movement_status",
          "movement",
        ],
        label: "Vehicle Movement Status",
        lookup: "vehicleMovementStatus",
      },
      {
        keys: ["fuel_quota_balance", "fuelQuotaBalance"],
        label: "Fuel Quota Balance",
      },
      { keys: ["gims_asset_id", "gimsAssetId"], label: "GIMS Asset" },
      {
        keys: ["fitness_certificate_expiry", "fitnessCertificateExpiry"],
        label: "Fitness Certificate Expiry",
      },
    ],
  },
  {
    id: "agency",
    title: "Agency & Insurance",
    subtitle: "Ownership, transfers, and policy information.",
    fields: [
      
      {
        keys: [
          "original_agency_id",
          "originalAgencyId",
          "original_agency_name",
          "original_agency",
          "originalAgency",
        ],
        label: "Original Agency",
      },
      {
        keys: [
          "current_agency_id",
          "currentAgencyId",
          "current_agency_name",
          "current_agency",
          "currentAgency",
        ],
        label: "Current Agency",
      },
      {
        keys: [
          "insurance_provider_name",
          "insurance_provider",
          "insuranceProvider",
          "insurance_provider_id",
          "insuranceProviderId",
        ],
        label: "Insurance Provider",
      },
      {
        keys: ["insurance_expiry", "insuranceExpiry"],
        label: "Insurance Expiry",
      },
    ],
  },
] as const;

const GROUPED_KEY_SET = new Set<string>();
for (const section of VEHICLE_DETAIL_SECTIONS) {
  for (const field of section.fields) {
    for (const k of field.keys) GROUPED_KEY_SET.add(k);
  }
}
/** API envelope and raw ids omitted from "Additional information". */
for (const k of [
  "data",
  "message",
  "success",
  "vehicle_status_id",
  "vehicleStatusId",
  "vehicle_movement_status_id",
  "vehicleMovementStatusId",
  "insurance_provider_id",
  "insuranceProviderId",
  "original_agency_id",
  "originalAgencyId",
  "original_department_id",
  "originalDepartmentId",
  "original_division_id",
  "originalDivisionId",
  "original_sub_division_id",
  "originalSubDivisionId",
  "original_entity_id",
  "originalEntityId",
  "current_agency_id",
  "currentAgencyId",
  "current_department_id",
  "currentDepartmentId",
  "current_division_id",
  "currentDivisionId",
  "current_sub_division_id",
  "currentSubDivisionId",
  "current_entity_id",
  "currentEntityId",
  "original_assignment",
  "originalAssignment",
  "current_assignment",
  "currentAssignment",
  "vin",
  "VIN",
] as const) {
  GROUPED_KEY_SET.add(k);
}

export function isGroupedVehicleDetailKey(key: string): boolean {
  return GROUPED_KEY_SET.has(key);
}
