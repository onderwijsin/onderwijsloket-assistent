import { locationRecord, availabilityRecord } from "./institutions-and-programs";
import { sectorRecord } from "./faqs-and-sectors";

export const deskId = "550e8400-e29b-41d4-a716-446655440050";
export const areaId = "550e8400-e29b-41d4-a716-446655440051";
export const areaRecord = {
  id: areaId,
  title: "Synthetic service region",
  area_center: { type: "Point", coordinates: [5, 52] },
  area_bounds: {
    type: "Polygon",
    coordinates: [
      [
        [4, 51],
        [6, 51],
        [6, 53],
        [4, 51]
      ]
    ]
  },
  area_inner: {
    type: "MultiPoint",
    coordinates: [
      [5, 52],
      [5.1, 52.1]
    ]
  }
};
export const deskRecord = {
  id: deskId,
  title: "Regional advice desk",
  slug: "regional-advice",
  path: "/navigator/regioloketten/regional-advice",
  date_updated: null,
  website: "https://desk.example.test/",
  email: "advice@example.test",
  phone: "0123456789",
  has_consultation_service: true,
  has_physical_location: true,
  appointment_for_visit: false,
  area: areaRecord,
  location: locationRecord,
  logo: null,
  regions: ["Synthetic region"],
  cities_municipalities: "Example City, Sample Town",
  sectors: [{ sectors_id: sectorRecord }],
  description: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Independent regional guidance." }] }
    ]
  },
  consultation_service_description: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Book an advice conversation." }] }
    ]
  },
  consultation_service_url: "https://desk.example.test/book",
  phone_availability: {
    ...availabilityRecord,
    id: "550e8400-e29b-41d4-a716-446655440052",
    monday_start: "09:00:00",
    monday_end: "17:00:00"
  },
  email_response_time: "zo snel mogelijk",
  service_links: [
    {
      url: "https://desk.example.test/orientation",
      type: "oriëntatie",
      domain: "desk.example.test"
    }
  ],
  orientation_activity_types: ["webinars", "open dagen (opleiding)", "anders"],
  content_types: ["podcasts", "anders"]
};
