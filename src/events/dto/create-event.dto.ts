export class CreateEventDto {
  event_applicant_name?: string;
  event_applicant_institution?: string;
  event_department?: string;
  event_designation?: string;
  event_organizer_name?: string;
  event_organizer_phone?: string;
  event_details?: string;
  event_purpose?: string;
  event_date?: string | Date;
  event_start_time?: string | Date;
  event_end_time?: string | Date;
  event_participant_count?: string | number;
  event_guest_name?: string;
  event_presiding_officers?: string | number;
  event_micset?: string | boolean;
  event_white_board?: string | boolean;

  approvals?: any;
  officeUse?: any;
}
