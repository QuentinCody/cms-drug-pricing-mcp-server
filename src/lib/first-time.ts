/** Native metadata and pharmacy-pricing month links verified October 4, 2026. */
export const FIRST_TIME_NADAC_ID = "e3af839d-8175-5be0-b94e-4a302ed7a035";

export const FIRST_TIME_NADAC_SCOPE = {
  dataset_id: FIRST_TIME_NADAC_ID,
  verified_on: "2026-10-04",
  provider_url: "https://www.medicaid.gov/medicaid/prescription-drugs/pharmacy-pricing",
  record_unit: "drug rate group, not an individual NDC",
  dates: "as_of_date identifies first appearance on NADAC; metadata modification and distribution filename dates are separate. Select a reported month explicitly; unfiltered rows are not necessarily newest first.",
  values: "Keep native rate, package-size, unit, classification, reason and NDC-count strings. NDC counts do not identify individual NDCs. First-time NADAC is not synonymous with a newly marketed drug or every new NDC.",
  dictionary_caveat: "Provider dictionary examples differ from observed classification/reason strings. Preserve native labels; do not remap them to dictionary examples or infer reimbursement.",
};
