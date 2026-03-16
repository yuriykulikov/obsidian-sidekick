# 12-Factor Agents

Following [12-Factor Agents](https://github.com/humanlayer/12-factor-agents), these principles guide the development of
AI agents by emphasizing deterministic control and clear boundaries between LLM reasoning and code execution.

### Factor 1: Natural Language to Tool Calls

Convert unstructured natural language into structured, deterministic tool calls. Use the LLM as a translator that maps
user intent to specific function signatures and parameters that your code can execute.

### Factor 2: Own your prompts

Avoid "black box" frameworks that hide prompt engineering behind abstractions. Treat prompts as first-class code that
you can version, test, and tune precisely to control the tokens being sent to the model.

### Factor 3: Own your context window

Be intentional about every piece of information sent to the LLM. Manually manage the assembly of instructions, retrieved
documents (RAG), and conversation history to ensure the model has the optimal "state of the world" for its next
decision.

### Factor 4: Tools are just structured outputs

View tool calling not as a magical capability, but as the model returning structured data (like JSON) that your code
then parses. This demystifies agent behavior and allows for standard validation and error handling on the model's "
intent."

### Factor 5: Unify execution state and business state

Simplify agent architecture by keeping the "work-in-progress" state (e.g., current step, retry counts) together with
the "business" state (e.g., message history, tool results). This reduces the complexity of tracking an agent's progress
across multiple turns.

### Factor 6: Launch/Pause/Resume with simple APIs

Design agents to be interruptible. Use clear APIs to start a task, pause it while waiting for long-running processes or
human input, and resume it later without losing context or requiring deep internal integration.

### Factor 7: Contact humans with tool calls

Treat human interaction as just another tool. When an agent needs clarification, approval, or help, it should "call" a
human-contact tool, allowing the orchestrator to handle the asynchronous communication and feed the response back as a
tool result.

### Factor 8: Own your control flow

Implement the agent's loop (read-think-act) in your own code rather than relying on framework-managed loops. This gives
you full control over when to break the loop, how to handle errors, and where to insert custom logic like "
LLM-as-a-judge."

### Factor 9: Compact Errors into Context Window

When tools fail, don't just dump raw stack traces into the LLM's context. Format and truncate errors to be informative
for the model while preserving space, and use deterministic logic to decide when to retry or escalate.

### Factor 10: Small, Focused Agents

Build specialized agents with narrow scopes rather than monolithic "do-everything" bots. Smaller tasks lead to shorter
context windows, higher reliability, and easier debugging.

### Factor 11: Trigger from anywhere, meet users where they are

Enable agents to be activated and respond through various channels like Slack, email, or webhooks. Meeting users in
their existing workflows makes agents feel like integrated digital coworkers.

### Factor 12: Make your agent a stateless reducer

Treat the agent logic as a pure, stateless function that takes the current state plus a new input and returns the
updated state. This functional approach makes agents predictable, easy to test, and simple to resume from any point.
