import WidgetKit
import SwiftUI

// MARK: - Data Models

struct BioPointData {
    let score: Int
    let trend: String
    let stacksDone: Int
    let stacksTotal: Int
    let calories: Int
    let calorieTarget: Int
    let lastUpdated: Date
}

// MARK: - Timeline Provider

struct BioPointProvider: TimelineProvider {
    func placeholder(in context: Context) -> BioPointEntry {
        BioPointEntry(date: Date(), data: fallbackData)
    }

    func getSnapshot(in context: Context, completion: @escaping (BioPointEntry) -> Void) {
        completion(BioPointEntry(date: Date(), data: loadData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BioPointEntry>) -> Void) {
        let entry = BioPointEntry(date: Date(), data: loadData())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func loadData() -> BioPointData {
        guard let defaults = UserDefaults(suiteName: "group.com.biopoint.app"),
              let jsonString = defaults.string(forKey: "widget_data"),
              let jsonData = jsonString.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] else {
            return fallbackData
        }

        return BioPointData(
            score: Int(dict["biopoint_score"] ?? "") ?? 0,
            trend: dict["biopoint_trend"] ?? "--",
            stacksDone: Int(dict["stacks_done"] ?? "") ?? 0,
            stacksTotal: Int(dict["stacks_total"] ?? "") ?? 0,
            calories: Int(dict["calories_today"] ?? "") ?? 0,
            calorieTarget: Int(dict["calorie_target"] ?? "") ?? 2000,
            lastUpdated: Date()
        )
    }

    private var fallbackData: BioPointData {
        BioPointData(score: 0, trend: "--", stacksDone: 0, stacksTotal: 0, calories: 0, calorieTarget: 2000, lastUpdated: Date())
    }
}

// MARK: - Timeline Entry

struct BioPointEntry: TimelineEntry {
    let date: Date
    let data: BioPointData
}

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let data: BioPointData

    var scoreColor: Color {
        if data.score >= 80 { return .green }
        if data.score >= 50 { return .orange }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "heart.text.square.fill")
                    .foregroundColor(.blue)
                    .font(.title3)
                Text("BioPoint")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
            }

            Spacer()

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(data.score)")
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundColor(scoreColor)
                Text("/100")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text("\(data.trend) today")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let data: BioPointData

    var scoreColor: Color {
        if data.score >= 80 { return .green }
        if data.score >= 50 { return .orange }
        return .red
    }

    var calorieProgress: Double {
        guard data.calorieTarget > 0 else { return 0 }
        return min(Double(data.calories) / Double(data.calorieTarget), 1.0)
    }

    var body: some View {
        HStack(spacing: 16) {
            // Score section
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "heart.text.square.fill")
                        .foregroundColor(.blue)
                    Text("BioPoint")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                }

                Spacer()

                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(data.score)")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundColor(scoreColor)
                    Text("/100")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text("\(data.trend) today")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Stats section
            VStack(alignment: .leading, spacing: 10) {
                Spacer()

                // Stacks
                HStack(spacing: 6) {
                    Image(systemName: "pills.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                    Text("Stacks")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(data.stacksDone)/\(data.stacksTotal)")
                        .font(.caption)
                        .fontWeight(.semibold)
                }

                // Calories
                HStack(spacing: 6) {
                    Image(systemName: "flame.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                    Text("Calories")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(data.calories)")
                        .font(.caption)
                        .fontWeight(.semibold)
                }

                // Calorie progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.orange)
                            .frame(width: geo.size.width * calorieProgress, height: 6)
                    }
                }
                .frame(height: 6)

                Spacer()
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Widget Definition

struct BioPointWidget: Widget {
    let kind: String = "BioPointWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BioPointProvider()) { entry in
            if #available(iOS 17.0, *) {
                switch entry.date {
                default:
                    SmallWidgetView(data: entry.data)
                }
            }
        }
        .configurationDisplayName("BioPoint Score")
        .description("Track your daily BioPoint score, stacks, and nutrition at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Widget Bundle

@main
struct BioPointWidgetBundle: WidgetBundle {
    var body: some Widget {
        BioPointWidget()
    }
}
