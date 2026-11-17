// Ranges used only to generate DEMO lots. They are typical literature ranges by feedstock, not data about any real producer.
// Sources: bulk density 80–320 kg/m³ (Biochar Journal, per team research); wood biochar surface area up to ~400–500 m²/g (USBI stormwater talk);
// rice-husk char ~40% ash (team research, concrete/steel doc); Terra Char publishes fixed carbon 76–94% for wood char; H:Corg ≤0.7 is the IBI/EBC threshold.
// Metals ranges are set well below IBI maxima except where a demo lot is built to fail.
export const RANGES = {
  wood: { c_org: [70, 90], ash: [2, 12], h_corg: [0.25, 0.55], ph: [7.5, 10.2], bulk_density: [150, 280], surface_area: [250, 480], cec: [10, 45], ec: [0.2, 1.5], whc: [150, 320] },
  ag: { c_org: [45, 65], ash: [25, 42], h_corg: [0.3, 0.6], ph: [8.5, 10.6], bulk_density: [180, 320], surface_area: [120, 300], cec: [20, 60], ec: [0.8, 3.2], whc: [120, 260] },
  manure: { c_org: [35, 55], ash: [30, 50], h_corg: [0.4, 0.68], ph: [9, 10.8], bulk_density: [250, 320], surface_area: [20, 120], cec: [30, 70], ec: [2, 6], whc: [100, 200] },
  biosolids: { c_org: [25, 40], ash: [50, 70], h_corg: [0.4, 0.68], ph: [7, 9.5], bulk_density: [280, 320], surface_area: [30, 120], cec: [15, 40], ec: [1, 4], whc: [80, 160] },
} as const;
