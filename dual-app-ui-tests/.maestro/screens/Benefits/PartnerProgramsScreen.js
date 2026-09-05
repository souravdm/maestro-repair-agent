// screens/Benefits/PartnerProgramsScreen.js
// Element definitions for Partner Programs and Wellness screen
// Used by: flows/Benefits/partner-programs*.yaml, subflows/Benefits/*.yaml
// Platform: iOS & Android (Health100 Beta)

// WARNING: This feature may not be fully implemented in current app build
// Verify partner programs exist before using these selectors
// Last verified: 2026-04-20 - Limited Flutter code found for partner programs

output.benefits_partner_programs = {
  // Page header
  pageTitle: "Partner Programs",
  wellnessProgramsTitle: "Wellness Programs",
  forYouTitle: "For You",
  
  // Program categories
  recommendedProgramsTitle: "Recommended Programs",
  enrolledProgramsTitle: "My Programs|Enrolled Programs",
  allProgramsTitle: "All Programs",
  
  // Program cards
  programCard: ".*Program.*|.*Wellness.*",
  programName: "Headspace|Solera|Xpo|Everyday Health|Care Consult",
  programDescription: ".*",
  programImage: "program_image",
  
  // Specific programs
  headspaceCard: "Headspace",
  headspaceDescription: "Meditation.*|Mental.*",
  
  soleraCard: "Solera",
  soleraDescription: "Health.*Goals.*|Wellness.*",
  
  xpoCard: "Xpo",
  xpoDescription: "Video.*|Fitness.*",
  
  everydayHealthCard: "Everyday Health",
  everydayHealthDescription: "Articles.*|Health.*",
  
  careConsultCard: "Care Consult",
  careConsultDescription: "Consult.*|Care.*",
  
  // Program details
  programDetailTitle: "Program Details",
  benefitsDescription: "Benefits.*|Description.*",
  pricingLabel: "Pricing|Cost",
  regularPrice: "Regular: \\$[0-9,]+\\.[0-9]{2}",
  memberPrice: "Member: \\$[0-9,]+\\.[0-9]{2}|Free for members",
  discountLabel: "Save [0-9]+%|Discount",
  
  // Program actions
  enrollBtn: "Enroll|Get Started|Sign Up",
  learnMoreBtn: "Learn More",
  accessProgramBtn: "Access|Open|Launch",
  viewDetailsBtn: "View Details",
  
  // Enrollment status
  enrolledBadge: "Enrolled|Active",
  notEnrolledBadge: "Not Enrolled",
  enrollmentDate: "Enrolled on [0-9]{2}/[0-9]{2}/[0-9]{4}",
  
  // Solera integration
  soleraEntryPoint: "Solera Health Goals|Start Questionnaire",
  healthGoalsTitle: "Health Goals",
  questionnaireTitle: "Health Questionnaire",
  startQuestionnaireBtn: "Start|Begin",
  submitQuestionnaireBtn: "Submit|Complete",
  viewRecommendationsBtn: "View Recommendations",
  
  // Content types
  videoContent: "Video|Watch",
  audioContent: "Audio|Listen",
  articleContent: "Article|Read",
  
  // Wellness content
  xpoVideoTitle: ".*Video.*",
  playVideoBtn: "Play|Watch",
  videoPlayer: "video_player",
  
  headspaceAudioTitle: ".*Meditation.*|.*Audio.*",
  playAudioBtn: "Play|Listen",
  audioPlayer: "audio_player",
  
  everydayHealthArticleTitle: ".*Article.*",
  readArticleBtn: "Read|Open",
  
  // Filters and search
  searchField: "Search programs",
  searchFieldId: "program_search",
  filterBtn: "Filter",
  categoryFilter: "Category",
  
  mentalHealthCategory: "Mental Health",
  fitnessCategory: "Fitness",
  nutritionCategory: "Nutrition",
  chronicCareCategory: "Chronic Care",
  
  // Navigation
  backBtn: "Back",
  closeBtn: "Close",
  
  // Empty states
  noProgramsMessage: "No programs found|No programs available",
  noRecommendationsMessage: "No recommendations|Complete questionnaire",
  
  // Loading states
  loadingPrograms: "Loading.*|Please wait",
  
  // Error states
  errorMessage: "Unable to load programs|Error|Try again",
  enrollmentError: "Enrollment failed|Unable to enroll"
};
