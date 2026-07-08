-- CreateTable
CREATE TABLE "EventsBooking" (
    "id" SERIAL NOT NULL,
    "event_applicant_name" TEXT NOT NULL,
    "event_applicant_institution" TEXT NOT NULL,
    "event_department" TEXT NOT NULL,
    "event_designation" TEXT NOT NULL,
    "event_organizer_name" TEXT NOT NULL,
    "event_organizer_phone" TEXT NOT NULL,
    "event_details" TEXT NOT NULL,
    "event_purpose" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_start_time" TIMESTAMP(3) NOT NULL,
    "event_end_time" TIMESTAMP(3) NOT NULL,
    "event_participant_count" INTEGER NOT NULL,
    "event_guest_name" TEXT NOT NULL,
    "event_presiding_officers" INTEGER NOT NULL,
    "event_micset" BOOLEAN NOT NULL DEFAULT false,
    "event_white_board" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventsBooking_pkey" PRIMARY KEY ("id")
);
