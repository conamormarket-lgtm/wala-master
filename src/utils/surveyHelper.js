export const shouldPromptSurvey = (userProfile) => {
  if (!userProfile) return false;
  if (userProfile.hasCompletedSurvey) return false;
  if (!userProfile.lastSurveyPromptedAt) return true;
  
  const daysSincePrompt = (Date.now() - userProfile.lastSurveyPromptedAt) / (1000 * 60 * 60 * 24);
  return daysSincePrompt >= 14;
};
