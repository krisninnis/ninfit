# Journey native safe completion gate v2

Temporary review-build marker only. Do not merge this review branch.

This rerun follows correction of two test mocks after `JourneyMotionSession.stopProvider()` became part of the explicit session contract. Product behavior is unchanged: quiesce live callbacks, drain durable native fixes, clear the matching queue, then persist completion; replay failure keeps the active Journey recoverable.
