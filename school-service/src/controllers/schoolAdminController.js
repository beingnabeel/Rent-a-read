const axios = require("axios");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllUserProfilesBySchool = catchAsync(async (req, res, next) => {
  const { schoolId } = req.params;

  if (!schoolId) {
    return next(new AppError("School ID is required", 400));
  }

  // Forward the authorization header from the incoming request
  const headers = {
    Authorization: req.headers.authorization,
  };

  // Make microservice call to user-management service
  const response = await axios.get("http://localhost:8080/users/profiles", {
    headers,
  });

  console.log('Searching for schoolId:', schoolId);

  // Extract and filter profiles from the nested structure
  const filteredProfiles = response.data.reduce((acc, userData) => {
    const matchingProfiles = userData.userProfiles.filter(
      profile => profile.schoolId === schoolId
    );
    return [...acc, ...matchingProfiles];
  }, []);

  console.log('Filtered profiles:', filteredProfiles);

  res.status(200).json({
    status: "success",
    results: filteredProfiles.length,
    data: {
      profiles: filteredProfiles,
    },
  });
});

exports.getAllUserDocumentsBySchool = catchAsync(async (req, res, next) => {
  const { schoolId } = req.params;

  if (!schoolId) {
    return next(new AppError("School ID is required", 400));
  }

  const headers = {
    Authorization: req.headers.authorization,
  };

  // Get all profiles from user-management service
  const profilesResponse = await axios.get(
    "http://localhost:8080/users/profiles",
    { headers }
  );

  console.log('Searching for schoolId:', schoolId);

  // Extract and filter profiles from the nested structure
  const schoolProfiles = profilesResponse.data.reduce((acc, userData) => {
    const matchingProfiles = userData.userProfiles.filter(
      profile => profile.schoolId === schoolId
    );
    return [...acc, ...matchingProfiles];
  }, []);

  console.log('Filtered school profiles:', schoolProfiles);

  // Extract unique userId and profileId combinations
  const uniqueUserProfiles = schoolProfiles.map((profile) => ({
    userId: profile.userId,
    profileId: profile.profileId 
  }));

  console.log('Unique user profiles:', uniqueUserProfiles);

  // Fetch detailed information for each user-profile combination
  const detailedProfiles = await Promise.all(
    uniqueUserProfiles.map(async ({ userId, profileId }) => {
      const detailResponse = await axios.get(
        `http://localhost:8080/users/${userId}/profiles/${profileId}`,
        { headers }
      );
      return detailResponse.data;
    })
  );

  res.status(200).json({
    status: "success",
    results: detailedProfiles.length,
    data: {
      profiles: detailedProfiles,
    },
  });
});
