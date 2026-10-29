// Visibly fictional illustrations. No real identity template, person, issuer or biometric.
export const syntheticProofs = [
  {
    id: "consistent",
    name: "Fictional Demo Player",
    dob: "2013-02-03",
    expectedName: "Fictional Demo Player",
    expectedDob: "2013-02-03",
  },
  {
    id: "conflicting-dates",
    name: "Fictional Demo Player",
    dob: "2013-02-03",
    extra: "Birth Date: 2015-02-03",
    expectedName: "Fictional Demo Player",
    expectedDob: "2013-02-03",
  },
  {
    id: "altered-year",
    name: "Fictional Demo Player",
    dob: "2013-02-03",
    extra: "DOB: 2015-02-03",
    altered: true,
    expectedName: "Fictional Demo Player",
    expectedDob: "2013-02-03",
  },
  {
    id: "duplicate-other-player",
    name: "Fictional Demo Player",
    dob: "2013-02-03",
    expectedName: "Fictional Other Player",
    expectedDob: "2013-02-03",
  },
  {
    id: "unreadable",
    unreadable: true,
    expectedName: "Fictional Demo Player",
    expectedDob: "2013-02-03",
  },
  {
    id: "missing-evidence",
    extra: "Attendance card only. No age eligibility information.",
    expectedName: "Fictional Demo Player",
    expectedDob: "2013-02-03",
  },
];
export function syntheticProofSvg(fixture) {
  if (fixture.unreadable)
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="1000" height="650" fill="#ddd"/><text x="40" y="50" fill="#ccc" font-size="12">SYNTHETIC UNREADABLE TEST ONLY</text></svg>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="1000" height="650" fill="white"/><rect x="8" y="8" width="984" height="634" fill="none" stroke="#333" stroke-width="6"/><g font-family="Arial" font-size="30" fill="#111"><text x="45" y="70">SYNTHETIC TEST - NOT A REAL ID</text><text x="45" y="125">Fictional age evidence for software evaluation</text>${fixture.name ? `<text x="45" y="220">Name: ${fixture.name}</text>` : ""}${fixture.dob ? `<text x="45" y="290">DOB: ${fixture.dob}</text>` : ""}${fixture.extra ? `<text x="${fixture.altered ? 70 : 45}" y="365" ${fixture.altered ? 'fill="#a00" font-weight="bold"' : ""}>${fixture.extra}</text>` : ""}<text x="45" y="540">No real people, government issuer or photograph.</text><text x="45" y="590">NOT VALID PROOF. Human review required.</text></g></svg>`;
}
