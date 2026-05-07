export interface SectorAttribute {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'date';
  options?: string[];
  placeholder?: string;
}

export interface SectorConfig {
  code: string;
  label: string;
  defaultCategories: string[];
  attributes: SectorAttribute[];
}

export const SECTORS: SectorConfig[] = [
  {
    code: 'MOTOR_SPARES',
    label: 'Motor Spares',
    defaultCategories: [
      'Engine Components',
      'Suspension',
      'Braking',
      'Electrical',
      'Body Parts',
      'Filters',
      'Lubricants',
    ],
    attributes: [
      {
        id: 'partNumber',
        label: 'Part Number',
        type: 'text',
        placeholder: 'e.g. 12345-ABC',
      },
      { id: 'oeOemNumber', label: 'OE/OEM Number', type: 'text' },
      {
        id: 'compatibleVehicle',
        label: 'Compatibility',
        type: 'text',
        placeholder: 'e.g. Toyota Hilux 2015-2020',
      },
      {
        id: 'condition',
        label: 'Condition',
        type: 'select',
        options: ['New', 'Used', 'Remanufactured'],
      },
      { id: 'brand', label: 'Brand', type: 'text' },
    ],
  },
  {
    code: 'GROCERY',
    label: 'Grocery',
    defaultCategories: [
      'Fresh Produce',
      'Dairy',
      'Bakery',
      'Canned Goods',
      'Beverages',
      'Snacks',
      'Household',
    ],
    attributes: [
      { id: 'brand', label: 'Brand', type: 'text' },
      {
        id: 'packSize',
        label: 'Pack Size',
        type: 'text',
        placeholder: 'e.g. 1kg, 500ml',
      },
      { id: 'expiryDate', label: 'Expiry Date', type: 'date' },
      {
        id: 'unit',
        label: 'Standard Unit',
        type: 'text',
        placeholder: 'e.g. Each, Kg, Litre',
      },
    ],
  },
  {
    code: 'AGRICULTURE',
    label: 'Agriculture',
    defaultCategories: ['Livestock', 'Crops', 'Fertilizers', 'Equipment', 'Seeds', 'Fodder'],
    attributes: [
      { id: 'produceType', label: 'Produce Type', type: 'text' },
      {
        id: 'grade',
        label: 'Grade',
        type: 'select',
        options: ['Premium', 'Grade A', 'Grade B', 'Standard'],
      },
      {
        id: 'packaging',
        label: 'Packaging',
        type: 'text',
        placeholder: 'e.g. 50kg bag, Crate',
      },
      { id: 'harvestDate', label: 'Harvest Date', type: 'date' },
      { id: 'location', label: 'Farm Location', type: 'text' },
    ],
  },
  {
    code: 'VEHICLE_DEALER',
    label: 'Vehicle Dealer',
    defaultCategories: ['Passenger Cars', 'SUVs', 'Trucks', 'Buses', 'Bikes', 'Special Vehicles'],
    attributes: [
      { id: 'make', label: 'Make', type: 'text' },
      { id: 'model', label: 'Model', type: 'text' },
      { id: 'year', label: 'Year', type: 'number' },
      { id: 'mileage', label: 'Mileage (km)', type: 'number' },
      {
        id: 'fuelType',
        label: 'Fuel Type',
        type: 'select',
        options: ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
      },
      {
        id: 'transmission',
        label: 'Transmission',
        type: 'select',
        options: ['Manual', 'Automatic'],
      },
    ],
  },
  {
    code: 'PROPERTY_AGENT',
    label: 'Property Agent',
    defaultCategories: [
      'Residential Sale',
      'Residential Rent',
      'Commercial Sale',
      'Commercial Rent',
      'Land/Plot',
      'Industrial',
    ],
    attributes: [
      {
        id: 'propertyType',
        label: 'Property Type',
        type: 'select',
        options: ['House', 'Apartment', 'Townhouse', 'Office', 'Warehouse', 'Land'],
      },
      { id: 'suburb', label: 'Suburb', type: 'text' },
      { id: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { id: 'bathrooms', label: 'Bathrooms', type: 'number' },
      {
        id: 'priceType',
        label: 'Price Basis',
        type: 'select',
        options: ['Fixed Price', 'Monthly Rent', 'Daily Rate', 'Negotiable'],
      },
    ],
  },
  {
    code: 'HOTELS',
    label: 'Hotels',
    defaultCategories: ['Standard Room', 'Deluxe Room', 'Suite', 'Conference Hall', 'Spa Packages'],
    attributes: [
      { id: 'roomType', label: 'Room Type', type: 'text' },
      {
        id: 'amenities',
        label: 'Amenities',
        type: 'text',
        placeholder: 'e.g. Wifi, AC, Pool',
      },
      { id: 'location', label: 'Location Description', type: 'text' },
      { id: 'pricePerNight', label: 'Rate Per Night', type: 'number' },
    ],
  },
  {
    code: 'PROFESSIONALS',
    label: 'Professionals',
    defaultCategories: [
      'Legal',
      'Accounting',
      'Medical',
      'Engineering',
      'Architecture',
      'Consulting',
    ],
    attributes: [
      { id: 'profession', label: 'Profession', type: 'text' },
      { id: 'qualification', label: 'Qualification', type: 'text' },
      { id: 'serviceArea', label: 'Service Area', type: 'text' },
      {
        id: 'consultationMode',
        label: 'Consultation Mode',
        type: 'select',
        options: ['In-Person', 'Online', 'Hybrid'],
      },
    ],
  },
  {
    code: 'JOBBING_SERVICES',
    label: 'Jobbing Services',
    defaultCategories: [
      'Plumbing',
      'Electrical',
      'Carpentry',
      'Painting',
      'Cleaning',
      'Repair Work',
    ],
    attributes: [
      { id: 'serviceType', label: 'Service Type', type: 'text' },
      { id: 'areaOfOperation', label: 'Area Covered', type: 'text' },
      { id: 'experience', label: 'Years Experience', type: 'number' },
    ],
  },
  {
    code: 'HARDWARE',
    label: 'Hardware',
    defaultCategories: [
      'Tools',
      'Building Materials',
      'Paint',
      'Electrical',
      'Plumbing',
      'Fasteners',
    ],
    attributes: [
      { id: 'brand', label: 'Brand', type: 'text' },
      { id: 'material', label: 'Material', type: 'text' },
    ],
  },
  {
    code: 'TRANSPORT_LOGISTICS',
    label: 'Transport & Logistics',
    defaultCategories: [
      'Local Haulage',
      'Long Distance',
      'Couriers',
      'Warehouse Storage',
      'Removal Services',
    ],
    attributes: [
      {
        id: 'vehicleType',
        label: 'Vehicle Type',
        type: 'text',
        placeholder: 'e.g. 5 Ton Truck, Van',
      },
      {
        id: 'capacity',
        label: 'Capacity',
        type: 'text',
        placeholder: 'e.g. 5000kg',
      },
      {
        id: 'rateBasis',
        label: 'Rate Basis',
        type: 'select',
        options: ['Per KM', 'Per Trip', 'Hourly', 'Fixed'],
      },
    ],
  },
  {
    code: 'CLOTHING',
    label: 'Clothing',
    defaultCategories: ['Mens', 'Womens', 'Kids', 'Shoes', 'Accessories'],
    attributes: [
      {
        id: 'size',
        label: 'Size',
        type: 'text',
        placeholder: 'e.g. XL, 34, 10',
      },
      { id: 'color', label: 'Color', type: 'text' },
      { id: 'fabric', label: 'Fabric/Material', type: 'text' },
      {
        id: 'gender',
        label: 'Gender',
        type: 'select',
        options: ['Male', 'Female', 'Unisex', 'Kids'],
      },
    ],
  },
  {
    code: 'GENERAL_DEALER',
    label: 'General Dealer',
    defaultCategories: ['Electronics', 'Home Appliances', 'Furniture', 'Gifts', 'Office Supplies'],
    attributes: [
      { id: 'brand', label: 'Brand', type: 'text' },
      { id: 'unit', label: 'Unit', type: 'text' },
      { id: 'packSize', label: 'Pack Size', type: 'text' },
    ],
  },
];

export function getSector(code: string): SectorConfig | undefined {
  return SECTORS.find((s) => s.code === code);
}
