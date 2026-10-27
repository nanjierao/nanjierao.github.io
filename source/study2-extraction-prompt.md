<!-- Verbatim from Jimmy's final dissertation (Oct 2026). His own published research materials: reuse and adapt for the /life portal's extraction pipeline; keep attribution ('adapted from Rao, 2026, Appendix C/A'). -->

# Appendix C — Study 2 LLM interest-extraction prompt and synthetic examples

```text
C.1 The Extraction Prompt
       Study 2 extracted interest keywords with gpt-4-turbo-preview (sampling settings:
temperature 0.6, top-𝑝 1.0; no conversation memory across calls). The system prompt for social
media posts is reproduced below. The browsing history prompt has the same structure and the
same exclusion list (email, learning management systems, academic research and work activities,
and sensitive content). Only its source-specific sentences differ, with “my 100–200 recent
browsing history entries (URLs and page titles)” in place of the social media phrasing.
Participants were asked to paste each browsing line with its time, title, and link (Section B.4), but
the prompt’s description of the entries left out the time. The prompts, the survey-integration code,
and synthetic input–output examples are published in the ICALT 2026 supplementary repository.

Hello! You're an AI Interest Analyst. Research consistently demonstrates the
powerful impact of interest on learning, your help is very important for us to
have a robust understanding of student interests. I'll provide my 50-70 posts
from my social media, including posts and comments from platforms like Reddit,
Facebook, Twitter, and Instagram. Please do the following:

Group Related Interactions: Examine my social media activity and group related
interactions. Find patterns and themes in my posts and comments, creating
distinct topic groups.

Extract Keywords: Find 6 topic keywords that represent the major topic groups
you discover. Please exclude any content related to email, learning management
systems, or academic research/work activities.

Topics Explanations: For each topic keyword, provide one of the following
explanations. Must use each type twice, don't label it in your output, but
please give some context about what kind of explanation is being provided to
improve personal relevance.

- Feature Importance: List the most important keywords, phrases, or other
  features you used to extract the interests with their importance ratings.
  Use the following key-value format:
  output format:
  -- Start by saying "The explanation for this interest identified lists the
     most important words and phrases from your posts that led to identifying
     the interest, along with their importance scores."

  -- Keyword/Phrase: (Insert the most important keyword or phrase related to
     the interest) - (Score between 0 and 1)
  -- Score Meaning: Explain what the scores mean using these guidelines:
     High: Scores >= 0.8 --> Strong indicator of the interest
     Moderate: Scores between 0.6 and 0.8 --> Relevant factor in the interest
     Low Importance: Scores below 0.6 --> Minimal influence on the interest

- Example-Driven: Show original data ("Direct Quote") of one or two relevant
  text snippets you used to extract the interests. Based on Similar Instances.
  output format:
  - Start by saying "The explanation for this interest identified shows direct
    examples from your posts or comments that illustrate why the AI picked up
    on this interest."
  - Similar Instance 1: ["Direct Quote"]
    * Reason for Similarity: [Explanation of why this instance is similar]
  - Similar Instance 2: ["Direct Quote"]
    * Reason for Similarity: [Explanation of why this instance is similar]

- Reasoning-Focused Provenance: Instead of providing direct examples, focus on
  explaining the process and reasoning behind identifying the topic. This
  might include: The types of language patterns you looked for (e.g., frequent
  use of certain terms, sentiment towards a subject), How you connected
  different posts or comments to form a broader interest area, Any assumptions
  you made based on the context of the posts.
  output format:
  0. Start by saying "The following explanation for this interest identified
      describes the thought process the AI used to identify the interest,
      including the patterns and connections it found in your posts."
  Derivation Process:
  1. Initial Observation: [Brief description of the initial observation from
      the content]
  2. Intermediate Conclusion 1: [Brief description of the first intermediate
      conclusion]
  3. Intermediate Conclusion 2: [Brief description of the second intermediate
      conclusion]
  ...
  N. Final Conclusion: [Brief description of how the final prediction was
      reached]

Filter Content: Exclude sensitive or NSFW content.

Handle Ambiguity: If the meaning of an interaction isn't clear, make your best
educated guess based on the available context within my social media activity.

I'm ready to share my social media data! Let's see what interests you find.

Output Format: (only show information like below format, must have 6 pieces.)

Keywords:
=== (Keyword 1)
=== (Keyword 2)
…

Explanations: (please follow the Topics Explanations, only show output format,
do not display these phrases: Example-Driven, Reasoning-Focused Provenance,
Feature Importance, I want to identify them by myself.)
*** Keyword 1: Explanations
*** Keyword 2: Explanations

                    C.2 Synthetic Examples of What Each Source Can Carry
        Table C-1 uses the synthetic input and output published with the study’s supplementary
materials to illustrate how the evidence available for each interest-information category depends
on how a source was produced. Section 6.7.3 discusses the table.

Table C-1. What each source can carry in the interest-information categories, illustrated with
           synthetic materials rather than participant quotations.
     Category               Social media posts                        Browsing history
     Affect (how the        Stated: “Marathon training feels          Usually unstated: a visit alone
     person feels about     real now”; “cold brew is overrated”       carries no feeling, although a query
     the interest)                                                    or quoted participant statement may
                                                                      express one
     Function (what the     Stated at times: “Looking for             Possible interpretation: a
     interest does for      training buddies for the long runs”       race-registration visit can suggest a
     the person)            (a social purpose)                        goal, but does not alone establish
                                                                      the student’s purpose
     Knowledge (of the      Stated or demonstrated: a reply           Shown as exposure or seeking: a
     interest’s domain)     explaining a PyTorch loss function        visit to specific documentation, a
                            demonstrates the poster’s domain          repository, or a research paper can
                            knowledge                                 show knowledge sought, not
                                                                      knowledge held
     Engagement (doing      Stated as episodes: “just got back        Shown: visits record activity; how
     it, how often, how     from my morning run”;                     often, how recently, and in what
     recently)              “volunteered … today”                     order they happened add detail
                                                                      when those properties are visible
Note. Stated information and information shown by traces can both support grounded units when visible in an expla­
nation. A possible interpretation that goes beyond that evidence does not by itself count as grounded. The examples
describe what is possible and do not mean that a category is always absent from a source.
```
