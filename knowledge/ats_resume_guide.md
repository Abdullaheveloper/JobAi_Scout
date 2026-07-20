# ATS Resume Knowledge Base
**File:** `knowledge/ats_resume_guide.md`

# ATS Resume Evaluation Knowledge Base (RAG)

Version: 1.0

Purpose:
This knowledge base is used by the AI Resume Analyzer to compare a user's resume against modern ATS (Applicant Tracking System) standards and industry hiring expectations.

The AI should analyze resumes differently depending on the candidate's career stage.

---

# Candidate Levels

The analyzer must first determine the candidate level.

## Level 1 — Fresher

Experience:
0 – 1 Year

Examples

- Student
- Graduate
- Final Year Student
- Internship Seeker
- Entry-Level Developer

Primary Goal

Get Interview Calls

Main Evaluation Focus

- Skills
- Projects
- Education
- Certifications
- ATS Formatting
- Keywords
- Portfolio

Weight Distribution

Education ............. 15%
Skills ................ 25%
Projects .............. 30%
Certifications ........ 10%
ATS Formatting ........ 10%
Keywords .............. 10%

---

## Level 2 — Early Career

Experience:
1 – 2.5 Years

Primary Goal

Show practical industry experience.

Focus

Experience ............ 35%
Projects .............. 20%
Skills ................ 20%
Achievements .......... 10%
ATS Formatting ........ 10%
Keywords .............. 5%

---

## Level 3 — Mid Level

Experience:
2.5 – 4.5 Years

Primary Goal

Show ownership, impact and measurable achievements.

Focus

Experience ............ 45%
Achievements .......... 20%
Skills ................ 15%
Leadership ............ 10%
Projects .............. 5%
ATS ................... 5%

---

## Level 4 — Senior

Experience:
4.5+ Years

Primary Goal

Show leadership and business impact.

Focus

Leadership ............ 25%
Business Impact ....... 25%
Architecture .......... 15%
Achievements .......... 15%
Experience ............ 15%
ATS ................... 5%

---

# Universal Resume Sections

Every professional resume should contain these sections whenever applicable.

## 1. Name

Required

Should be large and clear.

Good

Muhammad Ali

Bad

Resume of Muhammad Ali

---

## 2. Professional Title

Good

AI Engineer

Backend Developer

Machine Learning Engineer

Data Scientist

Frontend Developer

Bad

Student

Programmer

Developer

---

## 3. Contact Information

Must contain

✔ Phone Number

✔ Professional Email

✔ City

✔ Country

Optional

LinkedIn

GitHub

Portfolio

Personal Website

Kaggle

Medium

Google Scholar

---

# Contact Rules

Professional email only.

Good

abdullah.khan@gmail.com

Bad

kingboy786@gmail.com

---

# LinkedIn

Recommended

Missing LinkedIn should trigger

❌ LinkedIn profile missing

---

# GitHub

Required for

Software Engineers

AI Engineers

Data Scientists

Machine Learning Engineers

Backend Developers

Frontend Developers

Full Stack Developers

Prompt

❌ GitHub profile missing

---

# Portfolio

Recommended for

Frontend

UI UX

AI

ML

Data Science

Prompt

⚠ Portfolio website missing

---

# Professional Summary

Maximum

3–5 lines

Should contain

Years of experience

Primary technologies

Industry

Strength

Career objective

Good Example

AI Engineer with 2 years of experience developing LLM applications, AI agents, automation systems, and REST APIs using Python, FastAPI, LangChain, and OpenAI APIs. Passionate about solving business problems through AI automation.

Bad Example

Looking for a job where I can improve my skills.

Trigger

❌ Missing professional summary

---

# Skills Section

Must be categorized.

Example

Programming Languages

Python

Java

C++

JavaScript

Frameworks

FastAPI

Django

React

Next.js

AI

LangChain

OpenAI

HuggingFace

TensorFlow

PyTorch

Databases

PostgreSQL

MongoDB

MySQL

Redis

Cloud

AWS

Azure

Docker

Git

Prompt

❌ Skills not categorized

---

# Minimum Skills

Fresher

8+

Early Career

12+

Mid Level

15+

Senior

20+

Trigger

❌ Only X technical skills detected

---

# Education

Required

Degree

University

Duration

CGPA (Optional)

Expected Graduation

---

# Certifications

Examples

Google

IBM

Microsoft

AWS

DeepLearning.AI

Meta

Coursera

Udemy

Prompt

⚠ No certifications found

---

# Projects

Mandatory for Freshers

Each project must contain

Project Name

Description

Technologies

Responsibilities

Outcome

GitHub

Demo

Good Example

AI Resume Analyzer

Developed an AI-powered ATS Resume Analyzer using FastAPI, OpenAI, LangChain, ChromaDB and React that evaluates resumes against job descriptions and provides improvement suggestions.

---

Bad Example

Resume Project

Made using Python.

---

Prompt

❌ Weak project descriptions

---

# Experience

Each experience must include

Company

Role

Duration

Responsibilities

Achievements

Technologies

---

Weak Example

Worked on APIs.

Strong Example

Developed 25+ REST APIs using FastAPI, reducing response time by 35%.

---

# Quantified Achievements

Every experience should contain numbers whenever possible.

Examples

Reduced API response time by 40%

Improved accuracy from 82% to 95%

Saved 15 hours weekly

Handled 50K users

Built 30 APIs

Processed 2 Million records

Increased revenue by 18%

Reduced infrastructure cost by $500/month

---

Prompt

❌ No measurable achievements

---

# Action Verbs

Prefer

Built

Designed

Created

Developed

Implemented

Optimized

Automated

Improved

Reduced

Accelerated

Scaled

Managed

Architected

Migrated

Integrated

Enhanced

Led

Delivered

Eliminated

Streamlined

Avoid

Did

Worked

Helped

Made

Responsible for

Participated

Involved in

---

# Resume Length

Fresher

1 Page

Early Career

1–2 Pages

Mid Level

2 Pages

Senior

2–3 Pages

---

# ATS Formatting Rules

Allowed

Simple layout

One column preferred

Standard fonts

Calibri

Arial

Helvetica

Roboto

11–12 font size

Bullet points

PDF

---

Avoid

Tables

Text boxes

Headers

Footers

Images

Icons

Logos

Background colors

Charts

Multiple columns

Graphics

WordArt

---

Prompt

❌ ATS-unfriendly formatting detected

---

# ATS Keyword Matching

The AI must compare the resume with the Job Description.

Calculate

Keyword Match %

Categories

Skills

Frameworks

Libraries

Programming Languages

Cloud

Soft Skills

Responsibilities

Job Titles

Tools

Industries

Prompt

❌ Missing important keywords

---

# Soft Skills

Examples

Leadership

Communication

Problem Solving

Critical Thinking

Teamwork

Mentoring

Presentation

Collaboration

Time Management

Ownership

Decision Making

---

# AI Engineer Keywords

Python

FastAPI

LangChain

OpenAI

LLM

Prompt Engineering

Vector Database

ChromaDB

Pinecone

FAISS

RAG

AI Agent

MCP

n8n

Docker

REST API

Git

Linux

JSON

Embeddings

Transformers

HuggingFace

PyTorch

TensorFlow

OpenCV

NLP

Whisper

Redis

MongoDB

PostgreSQL

Azure

AWS

GCP

Kubernetes

CI/CD

---

# Backend Developer Keywords

Python

Java

Spring Boot

Node.js

Express

REST

GraphQL

PostgreSQL

MongoDB

Docker

Redis

RabbitMQ

Microservices

Git

CI/CD

Linux

---

# Frontend Keywords

React

Next.js

TypeScript

Redux

HTML

CSS

Tailwind

Material UI

Responsive Design

Accessibility

---

# Data Scientist Keywords

Python

Pandas

NumPy

Scikit-learn

TensorFlow

PyTorch

Power BI

SQL

Statistics

Machine Learning

Deep Learning

Data Visualization

---

# Resume File Rules

Preferred

PDF

Allowed

DOCX

Avoid

Images

Scanned PDF

---

# Grammar Rules

No spelling mistakes

No grammar mistakes

No repeated words

No inconsistent tense

No extra spaces

Professional capitalization

---

# Date Format

Preferred

Jan 2024 – Present

March 2022 – July 2023

Avoid

2022-2023

1/2/24

---

# Achievement Score

Every achievement should satisfy

Action

Metric

Business Value

Example

Optimized database indexing, reducing query execution time by 48%, improving customer dashboard performance.

---

# ATS Score Calculation

Formatting .......... 15

Sections ............ 15

Experience .......... 20

Projects ............ 15

Skills .............. 15

Keywords ............ 10

Achievements ........ 10

Grammar ............. 5

Certifications ...... 5

Total = 100

---

# Resume Grades

90–100

Excellent

80–89

Very Good

70–79

Good

60–69

Needs Improvement

Below 60

Poor

---

# Feedback Rules

Critical Issues

❌ Missing professional summary

❌ Missing LinkedIn profile

❌ Missing GitHub profile

❌ Missing projects

❌ Missing measurable achievements

❌ ATS formatting issue

❌ Missing required keywords

❌ Weak experience descriptions

❌ Weak project descriptions

❌ Resume exceeds recommended length

❌ No certifications

❌ Only X technical skills detected

---

# Suggestions

Use specific action verbs.

Add measurable achievements.

Use ATS-friendly formatting.

Match keywords with the job description.

Categorize technical skills.

Add GitHub.

Add LinkedIn.

Add certifications.

Add portfolio.

Improve project descriptions.

Include business impact.

Reduce unnecessary content.

Remove outdated technologies.

Avoid objective statements.

Replace responsibilities with achievements.

---

# Final AI Output Format

Resume Score

Overall ATS Score:
88 / 100

Career Level

Early Career

Strengths

✔ Strong Python skills

✔ Excellent projects

✔ Good ATS formatting

✔ Relevant technologies

Weaknesses

❌ Missing LinkedIn

❌ Only 6 technical skills

❌ No quantified achievements

❌ Weak project descriptions

❌ Missing certifications

❌ Missing portfolio

❌ Low keyword match

Keyword Match

72%

Missing Keywords

FastAPI

Docker

REST API

Redis

GitHub

CI/CD

Priority Fixes

1. Add LinkedIn profile.
2. Add measurable achievements with numbers.
3. Expand technical skills.
4. Improve project descriptions using action verbs.
5. Add certifications.
6. Add GitHub portfolio.
7. Optimize resume for ATS keywords from the job description.

---

# RAG Evaluation Workflow

Resume Upload
        ↓
Extract Text
        ↓
Detect Career Level
        ↓
Parse Resume Sections
        ↓
Validate ATS Formatting
        ↓
Check Required Sections
        ↓
Evaluate Experience
        ↓
Evaluate Projects
        ↓
Evaluate Skills
        ↓
Compare with Job Description
        ↓
Calculate Keyword Match
        ↓
Generate ATS Score
        ↓
Generate Missing Items
        ↓
Generate Improvement Suggestions
        ↓
Return Structured JSON + Human-Friendly Feedback
