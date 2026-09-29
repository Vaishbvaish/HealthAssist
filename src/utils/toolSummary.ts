export function formatToolCallSummary(toolName: string, args: Record<string, any>): string {
  if (!args) return toolName;

  switch (toolName) {
    case 'record_symptom':
      return `Extracted ${args.symptomName || 'symptom'} · Severity ${args.severity || '?'}/10 · Location: ${args.bodyLocation || 'unspecified'}`;

    case 'flag_triage_red_flag':
      return `RED FLAG [${(args.urgencyLevel || 'urgent').toUpperCase()}]: ${args.finding} (${args.clinicalRationale})`;

    case 'record_patient_history': {
      const items: string[] = [];
      if (args.allergies?.length) items.push(`Allergies: ${args.allergies.join(', ')}`);
      if (args.medications?.length) items.push(`Meds: ${args.medications.join(', ')}`);
      if (args.conditions?.length) items.push(`Conditions: ${args.conditions.join(', ')}`);
      return `Recorded Patient History · ${items.join(' · ') || 'Updated'}`;
    }

    case 'update_clinical_assessment':
      return `Clinical Assessment Updated · Impression: ${args.provisionalImpression || 'Pending'}`;

    case 'generate_doctor_handoff':
      return `Doctor SOAP Handoff Generated · Chief Complaint: ${args.chiefComplaint || 'Consultation'}`;

    default:
      return `${toolName} executed`;
  }
}
