Authentication
POST /api/auth/signup
Request

{
"username": "kunj",
"gamertag": "Shadow",
"email": "kunj@gmail.com",
"password": "123456"
}
Response

{
"success": true,
"message": "User created"
}
POST /api/auth/login
Request

{
"email": "kunj@gmail.com",
"password": "123456"
}
Response

{
"token": "jwt_token",
"user": {}
}
User
GET /api/users/profile
Response

{
"id": "",
"username": "",
"gamertag": "",
"skillLevel": ""
}
PUT /api/users/profile
Request

{
"gamertag": "Shadow",
"skillLevel": "Diamond"
}
Teams
POST /api/teams
{
"name": "Fire Hawks"
}
POST /api/teams/invite
{
"username": "player2"
}
Tournament
GET /api/tournaments
Returns every tournament.

POST /api/tournaments
{
"title": "Valorant Cup",
"game": "Valorant",
"maxTeams": 16
}
PUT /api/tournaments/:id
Update tournament.

DELETE /api/tournaments/:id
Delete tournament.

Registration
POST /api/registrations
{
"tournamentId": "...",
"teamId": "..."
}
Leaderboard
GET /api/leaderboard
Returns ranked players.

Match
PUT /api/matches/:id/score
{
"teamAScore": 13,
"teamBScore": 8
}
