# Shakti Gaming & Esports

## Core Features

- User Authentication
- Player Profiles
- Team Management
- Tournament CRUD
- Tournament Registration
- Search & Filter
- Leaderboard
- Responsive UI
- RBAC
- Error Handling

## Bonus Features

- Bracket Generator
- Live Score Updates
- Chat
- Riot API
- Match History
- Notifications

## Roles

Admin
Organizer
Player

Wireframe
                    HOME
                      │
      ┌───────────────┴───────────────┐
      │                               │
 Login/Signup                   Tournament List
      │                               │
      │                               │
  Profile ---------------- Tournament Details
      │                               │
      │                         Register Button
      │
      ├───────────┐
      │           │
   Team Page   Leaderboard
      │
 Match History
Navigation

Navbar

Logo

Home

Tournaments

Leaderboard

Teams

Profile

Login/Logout
3. Database Draft
User

id
username
gamertag
email
password
role
skillLevel

------------------

Team

id
name
captainId

------------------

TeamMember

teamId
userId
status

------------------

Tournament

id
title
game
maxTeams
status
organizerId

------------------

Registration

id
tournamentId
teamId

------------------

Match

id
tournamentId
teamA
teamB
winner
score